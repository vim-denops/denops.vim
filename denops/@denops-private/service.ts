import type {
  Denops,
  Meta,
} from "https://deno.land/x/denops_core@v5.0.0/mod.ts";
import type { Disposable } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
import { toFileUrl } from "https://deno.land/std@0.210.0/path/mod.ts";
import { Host } from "./host/base.ts";
import { Invoker } from "./host/invoker.ts";
import { DenopsImpl } from "./denops.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements Disposable {
  #plugins: Map<string, Plugin>;

  readonly host: Host;
  readonly meta: Meta;

  constructor(host: Host, meta: Meta) {
    this.#plugins = new Map();
    this.host = host;
    this.host.register(new Invoker(this));
    this.meta = meta;
  }

  load(
    name: string,
    script: string,
    suffix = "",
  ): Promise<void> {
    let plugin = this.#plugins.get(name);
    if (plugin) {
      if (this.meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is already loaded. Skip`);
      }
      return Promise.resolve();
    }
    const denops = new DenopsImpl(this, name);
    plugin = new Plugin(denops, name, script);
    this.#plugins.set(name, plugin);
    return plugin.load(suffix);
  }

  reload(
    name: string,
  ): Promise<void> {
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      if (this.meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is not registered yet. Skip`);
      }
      return Promise.resolve();
    }
    this.#plugins.delete(name);
    // Import module with fragment so that reload works properly
    // https://github.com/vim-denops/denops.vim/issues/227
    const suffix = `#${performance.now()}`;
    return this.load(name, plugin.script, suffix);
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const plugin = this.#plugins.get(name);
      if (!plugin) {
        throw new Error(`No plugin '${name}' is registered`);
      }
      return await plugin.call(fn, ...args);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e.toString()}`;
    }
  }

  dispose(): void {
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
      const mod = await import(`${this.script}${suffix}`);
      await emit(this.#denops, `DenopsSystemPluginPre:${this.name}`);
      await mod.main(this.#denops);
      await emit(this.#denops, `DenopsSystemPluginPost:${this.name}`);
    } catch (e) {
      console.error(e);
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
    console.warn(`Failed to emit ${name}: ${e}`);
  }
}

function resolveScriptUrl(script: string): string {
  try {
    return toFileUrl(script).href;
  } catch {
    return new URL(script, import.meta.url).href;
  }
}
