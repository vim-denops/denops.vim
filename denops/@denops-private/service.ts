// TODO: #349 Import `Entrypoint` from denops-core.
import type { Entrypoint } from "./plugin.ts";
import type { Denops, Meta } from "jsr:@denops/core@6.1.0";
import { toFileUrl } from "jsr:@std/path@0.224.0/to-file-url";
import { toErrorObject } from "jsr:@lambdalisue/errorutil@1.1.0";
import { DenopsImpl, type Host } from "./denops.ts";

/** Callback ID for `denops#callback#call()` */
type CallbackID = string;

type PluginModule = {
  main: Entrypoint;
};

type Waiter<Reason = unknown> = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: Reason) => void;
};

type PluginWaiterRejectReason = "DenopsClosed" | `DenopsPluginFail:${string}`;
type PluginWaiter = Waiter<PluginWaiterRejectReason>;

export type ScriptLoadOptions = {
  /**
   * If `true`, import the module without using the cache.
   * @default {false}
   */
  forceReload?: boolean;
};

/** Key: script path, Value: last suffix */
const scriptSuffixes = new Map<string, string>();

function createScriptSuffix(
  script: string,
  options?: ScriptLoadOptions,
): string {
  const { forceReload = false } = options ?? {};
  // Import module with fragment so that reload works properly
  // https://github.com/vim-denops/denops.vim/issues/227
  const suffix = forceReload
    ? `#${performance.now()}`
    : scriptSuffixes.get(script) ?? "";
  scriptSuffixes.set(script, suffix);
  return suffix;
}

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements AsyncDisposable {
  #plugins: Map<string, Plugin> = new Map();
  #pluginWaiters: Map<string, PluginWaiter> = new Map();
  #meta: Meta;
  #host?: Host;
  #closed = false;
  #closedWaiter: Waiter<never> = Promise.withResolvers();

  constructor(meta: Meta) {
    this.#meta = meta;
  }

  #getPluginWaiter(name: string): PluginWaiter {
    let waiter = this.#pluginWaiters.get(name)!;
    if (!waiter) {
      waiter = Promise.withResolvers();
      waiter.promise.catch(() => {});
      this.#pluginWaiters.set(name, waiter);
    }
    return waiter;
  }

  bind(host: Host): void {
    this.#host = host;
  }

  async load(
    name: string,
    script: string,
    options?: ScriptLoadOptions,
  ): Promise<void> {
    if (!this.#host || this.#closed) {
      throw new Error("No host is bound to the service");
    }
    if (this.#plugins.has(name)) {
      if (this.#meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is already loaded. Skip`);
      }
      return;
    }
    const denops = new DenopsImpl(name, this.#meta, this.#host, this);
    const plugin = new Plugin(denops, name, script);
    this.#plugins.set(name, plugin);
    const loaded = await plugin.load(options);
    if (!loaded) {
      // Load failure.
      this.#plugins.delete(name);
      this.#getPluginWaiter(name).reject(`DenopsPluginFail:${name}`);
    } else if (this.#plugins.has(name)) {
      // Load succeeded.
      this.#getPluginWaiter(name).resolve();
    } else {
      // Load succeeded, but unload was called during the loading.
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
    this.#plugins.delete(name);
    await plugin.unload();
    return plugin;
  }

  async unload(name: string): Promise<void> {
    await this.#unload(name);
  }

  async reload(name: string, options?: ScriptLoadOptions): Promise<void> {
    const plugin = await this.#unload(name);
    if (plugin) {
      await this.load(name, plugin.script, options);
    }
  }

  waitLoaded(name: string): Promise<void> {
    if (this.#closed) {
      return Promise.reject("DenopsClosed" satisfies PluginWaiterRejectReason);
    }
    return this.#getPluginWaiter(name).promise;
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
      return await this.#dispatch(name, fn, args);
    } catch (e) {
      throw toVimError(e);
    }
  }

  async dispatchAsync(
    name: string,
    fn: string,
    args: unknown[],
    success: CallbackID,
    failure: CallbackID,
  ): Promise<void> {
    if (!this.#host) {
      throw new Error("No host is bound to the service");
    }
    try {
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
      const waiters = [...this.#pluginWaiters.values()];
      this.#pluginWaiters.clear();
      for (const { reject } of waiters) {
        reject("DenopsClosed");
      }
      const plugins = [...this.#plugins.values()];
      this.#plugins.clear();
      await Promise.all(plugins.map((plugin) => plugin.unload()));
      this.#host = void 0;
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

class Plugin {
  #denops: Denops;
  #loadedPromise: Promise<boolean> | undefined;
  #disposable?: Partial<AsyncDisposable>;

  readonly name: string;
  readonly script: string;

  constructor(denops: Denops, name: string, script: string) {
    this.#denops = denops;
    this.name = name;
    this.script = resolveScriptUrl(script);
  }

  async load(options?: ScriptLoadOptions): Promise<boolean> {
    if (!this.#loadedPromise) {
      const { resolve, promise } = Promise.withResolvers<boolean>();
      this.#loadedPromise = promise;
      const suffix = createScriptSuffix(this.script, options);
      const script = `${this.script}${suffix}`;
      try {
        const mod: PluginModule = await import(script);
        await emit(this.#denops, `DenopsSystemPluginPre:${this.name}`);
        this.#disposable = await mod.main(this.#denops) ?? void 0;
        await emit(this.#denops, `DenopsSystemPluginPost:${this.name}`);
        resolve(true);
      } catch (e) {
        console.error(`Failed to load plugin '${this.name}': ${e}`);
        await emit(this.#denops, `DenopsSystemPluginFail:${this.name}`);
        resolve(false);
      }
    }
    return this.#loadedPromise;
  }

  async unload(): Promise<void> {
    const loaded = await this.#loadedPromise;
    this.#loadedPromise = Promise.resolve(false);
    if (!loaded) {
      return;
    }
    try {
      await emit(this.#denops, `DenopsSystemPluginUnloadPre:${this.name}`);
      await this.#disposable?.[Symbol.asyncDispose]?.();
      await emit(this.#denops, `DenopsSystemPluginUnloadPost:${this.name}`);
    } catch (e) {
      console.error(`Failed to unload plugin '${this.name}': ${e}`);
      await emit(this.#denops, `DenopsSystemPluginUnloadFail:${this.name}`);
    } finally {
      this.#disposable = void 0;
    }
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#denops.dispatcher[fn](...args);
  }
}

async function emit(denops: Denops, name: string): Promise<void> {
  try {
    await denops.cmd(`doautocmd <nomodeline> User ${name}`);
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

// NOTE:
// Vim/Neovim does not handle JavaScript Error instance thus use string instead
function toVimError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? err.toString();
  }
  return String(err);
}
