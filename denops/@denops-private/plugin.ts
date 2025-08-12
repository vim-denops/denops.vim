import { isObjectOf } from "@core/unknownutil/is/object-of";
import { isString } from "@core/unknownutil/is/string";
import { isUndefined } from "@core/unknownutil/is/undefined";
import type { Denops, Entrypoint } from "@denops/core";
import {
  type ImportMap,
  ImportMapImporter,
  isImportMap,
  loadImportMap,
} from "@lambdalisue/import-map-importer";
import { ensure } from "@core/unknownutil";
import { toFileUrl } from "@std/path/to-file-url";
import { fromFileUrl } from "@std/path/from-file-url";
import { parse as parseJsonc } from "@std/jsonc";

type PluginModule = {
  main: Entrypoint;
};

export class Plugin {
  #denops: Denops;
  #loadedWaiter: Promise<void>;
  #unloadedWaiter?: Promise<void>;
  #disposable: AsyncDisposable = voidAsyncDisposable;
  #scriptUrl: URL;

  readonly name: string;

  get script(): string {
    return this.#scriptUrl.href;
  }

  constructor(denops: Denops, name: string, script: string) {
    this.#denops = denops;
    this.name = name;
    this.#scriptUrl = resolveScriptUrl(script);
    this.#loadedWaiter = this.#load();
  }

  waitLoaded(): Promise<void> {
    return this.#loadedWaiter;
  }

  async #load(): Promise<void> {
    await emit(this.#denops, `DenopsSystemPluginPre:${this.name}`);
    try {
      const mod: PluginModule = await importPlugin(this.#scriptUrl);
      this.#disposable = await mod.main(this.#denops) ?? voidAsyncDisposable;
    } catch (e) {
      // Show a warning message when Deno module cache issue is detected
      // https://github.com/vim-denops/denops.vim/issues/358
      if (isDenoCacheIssueError(e)) {
        console.warn("*".repeat(80));
        console.warn(`Deno module cache issue is detected.`);
        console.warn(
          `Execute 'call denops#cache#update(#{reload: v:true})' and restart Vim/Neovim.`,
        );
        console.warn(
          `See https://github.com/vim-denops/denops.vim/issues/358 for more detail.`,
        );
        console.warn("*".repeat(80));
      }
      console.error(`Failed to load plugin '${this.name}': ${e}`);
      await emit(this.#denops, `DenopsSystemPluginFail:${this.name}`);
      throw e;
    }
    await emit(this.#denops, `DenopsSystemPluginPost:${this.name}`);
  }

  unload(): Promise<void> {
    if (!this.#unloadedWaiter) {
      this.#unloadedWaiter = this.#unload();
    }
    return this.#unloadedWaiter;
  }

  async #unload(): Promise<void> {
    try {
      // Wait for the load to complete to make the events atomically.
      await this.#loadedWaiter;
    } catch {
      // Load failed, do nothing
      return;
    }
    const disposable = this.#disposable;
    this.#disposable = voidAsyncDisposable;
    await emit(this.#denops, `DenopsSystemPluginUnloadPre:${this.name}`);
    try {
      await disposable[Symbol.asyncDispose]();
    } catch (e) {
      console.error(`Failed to unload plugin '${this.name}': ${e}`);
      await emit(this.#denops, `DenopsSystemPluginUnloadFail:${this.name}`);
      return;
    }
    await emit(this.#denops, `DenopsSystemPluginUnloadPost:${this.name}`);
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    try {
      return await this.#denops.dispatcher[fn](...args);
    } catch (err) {
      const errMsg = err instanceof Error
        ? err.stack ?? err.message // Prefer 'stack' if available
        : String(err);
      throw new Error(
        `Failed to call '${fn}' API in '${this.name}': ${errMsg}`,
      );
    }
  }
}

const voidAsyncDisposable = {
  [Symbol.asyncDispose]: () => Promise.resolve(),
} as const satisfies AsyncDisposable;

const loadedScripts = new Set<string>();

function refreshScriptFragment(scriptUrl: URL): URL {
  // Import module with fragment so that reload works properly
  // https://github.com/vim-denops/denops.vim/issues/227
  if (loadedScripts.has(scriptUrl.href)) {
    // Keep the original fragment and add a timestamp
    const fragment = `${scriptUrl.hash}#${performance.now()}`;
    return new URL(fragment, scriptUrl);
  }
  loadedScripts.add(scriptUrl.href);
  return scriptUrl;
}

/** NOTE: `emit()` is never throws or rejects. */
async function emit(denops: Denops, name: string): Promise<void> {
  try {
    await denops.call("denops#_internal#event#emit", name);
  } catch (e) {
    console.error(`Failed to emit ${name}: ${e}`);
  }
}

function resolveScriptUrl(script: string): URL {
  try {
    return toFileUrl(script);
  } catch {
    return new URL(script);
  }
}

// See https://github.com/vim-denops/denops.vim/issues/358 for details
function isDenoCacheIssueError(e: unknown): boolean {
  const expects = [
    "Could not find constraint in the list of versions: ", // Deno 1.40?
    "Could not find version of ", // Deno 1.38
  ] as const;
  if (e instanceof TypeError) {
    return expects.some((expect) => e.message.startsWith(expect));
  }
  return false;
}

async function loadJson(fileUrl: URL): Promise<unknown> {
  const content = await Deno.readTextFile(fileUrl);
  // Always parse as JSONC to be more permissive
  return parseJsonc(content);
}

const hasImportMapProperty = isObjectOf({
  importMap: isString,
  // If `imports` or `scopes` exists, they will be override `importMap`
  imports: isUndefined,
  scopes: isUndefined,
});

async function tryLoadImportMap(
  scriptUrl: URL,
): Promise<ImportMap | undefined> {
  if (scriptUrl.protocol !== "file:") {
    // We cannot load import maps for remote scripts
    return undefined;
  }
  const PATTERNS = [
    "deno.json",
    "deno.jsonc",
    "import_map.json",
    "import_map.jsonc",
  ];
  for (const pattern of PATTERNS) {
    let importMapUrl = new URL(pattern, scriptUrl);

    // Try to load the import map or deno configuration file
    let jsonValue: unknown;
    try {
      jsonValue = await loadJson(importMapUrl);
    } catch (err: unknown) {
      if (err instanceof Deno.errors.NotFound) {
        // Ignore NotFound errors and try the next pattern
        continue;
      }
      throw err; // Rethrow other errors
    }

    // Resolve import map path in the deno configuration and load it
    if (
      /\/deno\.jsonc?$/.test(importMapUrl.pathname) &&
      hasImportMapProperty(jsonValue)
    ) {
      importMapUrl = new URL(jsonValue.importMap, importMapUrl);
      jsonValue = await loadJson(importMapUrl);
    }

    // Resolve relative paths in the import map and return it
    const importMapPath = fromFileUrl(importMapUrl);
    return await loadImportMap(importMapPath, {
      loader: () => ensure(jsonValue, isImportMap),
    });
  }
  return undefined;
}

async function importPlugin(scriptUrl: URL): Promise<PluginModule> {
  scriptUrl = refreshScriptFragment(scriptUrl);
  const importMap = await tryLoadImportMap(scriptUrl);
  if (importMap) {
    const importer = new ImportMapImporter(importMap);
    return await importer.import<PluginModule>(scriptUrl.href);
  } else {
    return await import(scriptUrl.href);
  }
}
