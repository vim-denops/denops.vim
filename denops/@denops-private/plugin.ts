import type { Denops, Entrypoint } from "jsr:@denops/core@^7.0.0";
import { toFileUrl } from "jsr:@std/path@^1.0.2/to-file-url";

type PluginModule = {
  main: Entrypoint;
};

export class Plugin {
  #denops: Denops;
  #loadedWaiter: Promise<void>;
  #unloadedWaiter?: Promise<void>;
  #disposable: AsyncDisposable = voidAsyncDisposable;

  readonly name: string;
  readonly script: string;

  constructor(denops: Denops, name: string, script: string) {
    this.#denops = denops;
    this.name = name;
    this.script = resolveScriptUrl(script);
    this.#loadedWaiter = this.#load();
  }

  waitLoaded(): Promise<void> {
    return this.#loadedWaiter;
  }

  async #load(): Promise<void> {
    const suffix = createScriptSuffix(this.script);
    await emit(this.#denops, `DenopsSystemPluginPre:${this.name}`);
    try {
      const mod: PluginModule = await import(`${this.script}${suffix}`);
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

function createScriptSuffix(script: string): string {
  // Import module with fragment so that reload works properly
  // https://github.com/vim-denops/denops.vim/issues/227
  const suffix = loadedScripts.has(script) ? `#${performance.now()}` : "";
  loadedScripts.add(script);
  return suffix;
}

/** NOTE: `emit()` is never throws or rejects. */
async function emit(denops: Denops, name: string): Promise<void> {
  try {
    await denops.call("denops#_internal#event#emit", name);
  } catch (e) {
    console.error(`Failed to emit ${name}: ${e}`);
  }
}

function resolveScriptUrl(script: string): string {
  try {
    return toFileUrl(script).href;
  } catch {
    return new URL(script, import.meta.url).href;
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
