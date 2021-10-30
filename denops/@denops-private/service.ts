import { toFileUrl } from "https://deno.land/std@0.111.0/path/mod.ts";
import { Host } from "./host/base.ts";
import { Invoker, RegisterOptions } from "./host/invoker.ts";
import { bulkImport } from "./utils.ts";
import type { Denops, Meta } from "../@denops/types.ts";
import { DenopsImpl } from "./impl.ts";

type Module = {
  main(denops: Denops): void | Promise<void>;
};

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service {
  #reserves: [string, string][];
  #delayer?: number;
  #plugins: Map<string, { denops: Denops }>;
  #host: Host;
  #meta?: Meta;

  constructor(host: Host) {
    this.#reserves = [];
    this.#delayer = undefined;
    this.#plugins = new Map();
    this.#host = host;
    this.#host.register(new Invoker(this));
  }

  async #registerAll(): Promise<void> {
    if (!this.#meta) {
      throw new Error("Service has not initialized yet");
    }
    const reserves = this.#reserves.map((
      [name, script],
    ) => [name, toFileUrl(script).href]);
    const mods = await bulkImport<Module>(
      reserves.map(([_, script]) => script),
    );
    const meta = this.#meta;
    for (const [name, script] of reserves) {
      const denops = new DenopsImpl(name, meta, this);
      const { main } = mods[script];
      denops.cmd(`doautocmd <nomodeline> User DenopsPluginPre:${name}`)
        .catch((e) =>
          console.error(`Failed to emit DenopsPluginPre:${name}: ${e}`)
        );
      try {
        await main(denops);
        denops.cmd(`doautocmd <nomodeline> User DenopsPluginPost:${name}`)
          .catch((e) =>
            console.error(`Failed to emit DenopsPluginPost:${name}: ${e}`)
          );
        this.#plugins.set(name, { denops });
      } catch (e) {
        console.error(`Failed to initialize plugin ${name}: ${e}`);
      }
    }
    this.#reserves = [];
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
    this.#reserves.push([name, script]);
    if (this.#delayer) {
      clearTimeout(this.#delayer);
    }
    this.#delayer = setTimeout(() => this.#registerAll(), 50);
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
