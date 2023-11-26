import { toFileUrl } from "https://deno.land/std@0.208.0/path/mod.ts";
import type { Disposable } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
import type { Host } from "./host/base.ts";
import { Invoker } from "./host/invoker.ts";
import type { Meta } from "../@denops/mod.ts";
import type { Plugin } from "./plugin/base.ts";
import { WorkerPlugin } from "./plugin/worker/plugin.ts";

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

  register(
    name: string,
    script: string,
  ): void {
    const plugin = this.#plugins.get(name);
    if (plugin) {
      if (this.meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is already registered. Skip`);
      }
      return;
    }
    this.host.call(
      "execute",
      `doautocmd <nomodeline> User DenopsSystemPluginRegister:${name}`,
    ).catch((err) => {
      console.error(
        `Failed to emit DenopsSystemPluginRegister:${name}`,
        err,
      );
    });
    this.#plugins.set(
      name,
      new WorkerPlugin(name, resolveScriptUrl(script), this),
    );
  }

  reload(name: string): void {
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      if (this.meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is not registered yet. Skip`);
      }
      return;
    }
    plugin.dispose();
    this.#plugins.delete(name);
    this.register(name, plugin.script);
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
    for (const plugin of this.#plugins.values()) {
      plugin.dispose();
    }
  }
}

function resolveScriptUrl(script: string): string {
  try {
    return toFileUrl(script).href;
  } catch {
    return new URL(script, import.meta.url).href;
  }
}
