import type { Denops, Entrypoint, Meta } from "jsr:@denops/core@^7.0.0";
import { toFileUrl } from "jsr:@std/path@^1.0.2/to-file-url";
import { toErrorObject } from "jsr:@lambdalisue/errorutil@^1.1.0";
import { DenopsImpl, type Host } from "./denops.ts";
import type { CallbackId, Service as HostService } from "./host.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements HostService, AsyncDisposable {
  #interruptController = new AbortController();
  #plugins = new Map<string, Plugin>();
  #waiters = new Map<string, PromiseWithResolvers<void>>();
  #meta: Meta;
  #host?: Host;
  #closed = false;
  #closedWaiter = Promise.withResolvers<void>();

  constructor(meta: Meta) {
    this.#meta = meta;
  }

  #getWaiter(name: string): PromiseWithResolvers<void> {
    let waiter = this.#waiters.get(name);
    if (!waiter) {
      waiter = Promise.withResolvers();
      waiter.promise.catch(() => {});
      this.#waiters.set(name, waiter);
    }
    return waiter;
  }

  get interrupted(): AbortSignal {
    return this.#interruptController.signal;
  }

  bind(host: Host): void {
    this.#host = host;
  }

  async load(name: string, script: string): Promise<void> {
    if (this.#closed) {
      throw new Error("Service closed");
    }
    if (!this.#host) {
      throw new Error("No host is bound to the service");
    }
    assertValidPluginName(name);
    if (this.#plugins.has(name)) {
      if (this.#meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is already loaded. Skip`);
      }
      return;
    }
    const denops = new DenopsImpl(name, this.#meta, this.#host, this);
    const plugin = new Plugin(denops, name, script);
    this.#plugins.set(name, plugin);
    try {
      await plugin.waitLoaded();
      this.#getWaiter(name).resolve();
    } catch {
      this.#plugins.delete(name);
    }
  }

  async #unload(name: string): Promise<Plugin | undefined> {
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      if (this.#meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is not loaded yet. Skip`);
      }
      return;
    }
    this.#waiters.get(name)?.promise.finally(() => {
      this.#waiters.delete(name);
    });
    await plugin.unload();
    this.#plugins.delete(name);
    return plugin;
  }

  async unload(name: string): Promise<void> {
    assertValidPluginName(name);
    await this.#unload(name);
  }

  async reload(name: string): Promise<void> {
    assertValidPluginName(name);
    const plugin = await this.#unload(name);
    if (plugin) {
      await this.load(name, plugin.script);
    }
  }

  async waitLoaded(name: string): Promise<void> {
    if (this.#closed) {
      throw new Error("Service closed");
    }
    assertValidPluginName(name);
    await this.#getWaiter(name).promise;
  }

  interrupt(reason?: unknown): void {
    this.#interruptController.abort(reason);
    this.#interruptController = new AbortController();
  }

  async #dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      throw new Error(`No plugin '${name}' is loaded`);
    }
    return await plugin.call(fn, ...args);
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      assertValidPluginName(name);
      return await this.#dispatch(name, fn, args);
    } catch (e) {
      throw toVimError(e);
    }
  }

  async dispatchAsync(
    name: string,
    fn: string,
    args: unknown[],
    success: CallbackId,
    failure: CallbackId,
  ): Promise<void> {
    if (!this.#host) {
      throw new Error("No host is bound to the service");
    }
    try {
      assertValidPluginName(name);
      const r = await this.#dispatch(name, fn, args);
      try {
        await this.#host.call("denops#callback#call", success, r);
      } catch (e) {
        console.error(`Failed to call success callback '${success}': ${e}`);
      }
    } catch (e) {
      try {
        const err = e instanceof Error
          ? toErrorObject(e)
          : { name: typeof e, message: String(e) };
        await this.#host.call("denops#callback#call", failure, err);
      } catch (e) {
        console.error(`Failed to call failure callback '${failure}': ${e}`);
      }
    }
  }

  async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      const error = new Error("Service closed");
      for (const { reject } of this.#waiters.values()) {
        reject(error);
      }
      this.#waiters.clear();
      await Promise.all(
        [...this.#plugins.values()].map((plugin) => plugin.unload()),
      );
      this.#plugins.clear();
      this.#host = undefined;
      this.#closedWaiter.resolve();
    }
    return this.waitClosed();
  }

  waitClosed(): Promise<void> {
    return this.#closedWaiter.promise;
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }
}

// NOTE: same as autoload/denops/_internal/plugin.vim
const VALID_NAME_PATTERN = /^[-_0-9a-zA-Z]+$/;

function assertValidPluginName(name: string) {
  if (!VALID_NAME_PATTERN.test(name)) {
    throw new TypeError(`Invalid plugin name: ${name}`);
  }
}

type PluginModule = {
  main: Entrypoint;
};

class Plugin {
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
      const errMsg = err.message ?? err;
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

// NOTE:
// Vim/Neovim does not handle JavaScript Error instance thus use string instead
function toVimError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? err.toString();
  }
  return String(err);
}
