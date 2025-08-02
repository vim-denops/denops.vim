import type { Meta } from "@denops/core";
import { toErrorObject } from "@core/errorutil";
import { DenopsImpl, type Host } from "./denops.ts";
import type { CallbackId, Service as HostService } from "./host.ts";
import { Plugin } from "./plugin.ts";

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

  waitLoaded(name: string): Promise<void> {
    try {
      if (this.#closed) {
        throw new Error("Service closed");
      }
      assertValidPluginName(name);
    } catch (e) {
      return Promise.reject(e);
    }
    return this.#getWaiter(name).promise;
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

// NOTE:
// Vim/Neovim does not handle JavaScript Error instance thus use string instead
function toVimError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? err.toString();
  }
  return String(err);
}
