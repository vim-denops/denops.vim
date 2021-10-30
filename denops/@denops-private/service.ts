import { toFileUrl } from "https://deno.land/std@0.111.0/path/mod.ts";
import { Host } from "./host/base.ts";
import { Invoker, RegisterOptions } from "./host/invoker.ts";
import type { Denops, Meta } from "../@denops/types.ts";
import { DenopsImpl } from "./impl.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service {
  #plugins: Map<string, { denops: Denops }>;
  #host: Host;
  #meta?: Meta;

  constructor(host: Host) {
    this.#plugins = new Map();
    this.#host = host;
    this.#host.register(new Invoker(this));
  }

  init(meta: Meta): void {
    this.#meta = meta;
  }

  register(
    name: string,
    script: string,
    options: RegisterOptions,
  ): void {
    if (!this.#meta) {
      throw new Error("Service has not initialized yet");
    }
    const plugin = this.#plugins.get(name);
    if (plugin) {
      if (options.mode === "reload") {
        if (this.#meta.mode === "debug") {
          console.log(
            `A denops plugin '${name}' is already registered. Reload`,
          );
        }
      } else if (options.mode === "skip") {
        if (this.#meta.mode === "debug") {
          console.log(`A denops plugin '${name}' is already registered. Skip`);
        }
        return;
      } else {
        throw new Error(`A denops plugin '${name}' is already registered`);
      }
    }
    const meta = this.#meta;
    const runner = async () => {
      const { main } = await import(toFileUrl(script).href);
      const denops = new DenopsImpl(name, meta, this);
      denops.cmd(`doautocmd <nomodeline> User DenopsPluginPre:${name}`)
        .catch((e) =>
          console.error(`Failed to emit DenopsPluginPre:${name}: ${e}`)
        );
      await main(denops);
      denops.cmd(`doautocmd <nomodeline> User DenopsPluginPost:${name}`)
        .catch((e) =>
          console.error(`Failed to emit DenopsPluginPost:${name}: ${e}`)
        );
      this.#plugins.set(name, {
        denops,
      });
      return denops;
    };
    runner().catch((e) =>
      console.error(`Failed to initialize plugin ${name}: ${e}`)
    );
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#host.call(fn, ...args);
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<[unknown[], string]> {
    return await this.#host.batch(...calls);
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const plugin = this.#plugins.get(name);
      if (!plugin) {
        throw new Error(`No plugin '${name}' is registered`);
      }
      const dispatcher = plugin.denops.dispatcher;
      if (!dispatcher[fn]) {
        throw new Error(`No method '${fn}' exists in plugin '${name}'`);
      }
      return await dispatcher[fn](...args);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e.toString()}`;
    }
  }

  waitClosed(): Promise<void> {
    return this.#host.waitClosed();
  }
}
