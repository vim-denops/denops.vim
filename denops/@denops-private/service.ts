import type { Denops, Meta } from "jsr:@denops/core@6.0.6";
import { toFileUrl } from "jsr:@std/path@0.225.0/to-file-url";
import { toErrorObject } from "jsr:@lambdalisue/errorutil@1.0.0";
import { DenopsImpl, type Host } from "./denops.ts";
import type { CallbackId, Service as HostService } from "./host.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements HostService, Disposable {
  #interruptController = new AbortController();
  #plugins = new Map<string, Plugin>();
  #waiters = new Map<string, PromiseWithResolvers<void>>();
  #meta: Meta;
  #host?: Host;

  constructor(meta: Meta) {
    this.#meta = meta;
  }

  #getWaiter(name: string): PromiseWithResolvers<void> {
    let waiter = this.#waiters.get(name);
    if (!waiter) {
      waiter = Promise.withResolvers();
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

  async load(
    name: string,
    script: string,
    suffix = "",
  ): Promise<void> {
    if (!this.#host) {
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
    await plugin.load(suffix);
    this.#getWaiter(name).resolve();
  }

  reload(
    name: string,
  ): Promise<void> {
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      if (this.#meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is not loaded yet. Skip`);
      }
      return Promise.resolve();
    }
    this.#plugins.delete(name);
    this.#waiters.delete(name);
    // Import module with fragment so that reload works properly
    // https://github.com/vim-denops/denops.vim/issues/227
    const suffix = `#${performance.now()}`;
    return this.load(name, plugin.script, suffix);
  }

  waitLoaded(name: string): Promise<void> {
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

  [Symbol.dispose](): void {
    this.#plugins.clear();
  }
}

class Plugin {
  #denops: Denops;

  readonly name: string;
  readonly script: string;

  constructor(denops: Denops, name: string, script: string) {
    this.#denops = denops;
    this.name = name;
    this.script = resolveScriptUrl(script);
  }

  async load(suffix = ""): Promise<void> {
    try {
      await emit(this.#denops, `DenopsSystemPluginPre:${this.name}`);
      const mod = await import(`${this.script}${suffix}`);
      await mod.main(this.#denops);
      await emit(this.#denops, `DenopsSystemPluginPost:${this.name}`);
    } catch (e) {
      // Show a warning message when Deno module cache issue is detected
      // https://github.com/vim-denops/denops.vim/issues/358
      if (
        e instanceof TypeError &&
        e.message.startsWith(
          "Could not find constraint in the list of versions: ",
        )
      ) {
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
