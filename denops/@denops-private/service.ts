import type {
  Denops,
  Meta,
} from "https://deno.land/x/denops_core@v6.0.5/mod.ts";
import { toFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";
import { toErrorObject } from "https://deno.land/x/errorutil@v0.1.1/mod.ts";
import { DenopsImpl, Host } from "./denops.ts";

// We can use `PromiseWithResolvers<void>` but Deno 1.38 doesn't have `PromiseWithResolvers`
type Waiter = {
  promise: Promise<void>;
  resolve: () => void;
};

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements Disposable {
  #plugins: Map<string, Plugin> = new Map();
  #waiters: Map<string, Waiter> = new Map();
  #meta: Meta;
  #host?: Host;

  constructor(meta: Meta) {
    this.#meta = meta;
  }

  #getWaiter(name: string): Waiter {
    if (!this.#waiters.has(name)) {
      this.#waiters.set(name, Promise.withResolvers());
    }
    return this.#waiters.get(name)!;
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
    let plugin = this.#plugins.get(name);
    if (plugin) {
      if (this.#meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is already loaded. Skip`);
      }
      return;
    }
    const denops = new DenopsImpl(name, this.#meta, this.#host, this);
    plugin = new Plugin(denops, name, script);
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
    success: string, // Callback ID
    failure: string, // Callback ID
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
    }
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
