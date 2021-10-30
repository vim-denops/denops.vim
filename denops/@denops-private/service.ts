import { toFileUrl } from "https://deno.land/std@0.111.0/path/mod.ts";
import type { Dispatcher } from "https://deno.land/x/msgpack_rpc@v3.1.4/mod.ts#^";
import { Host } from "./host/base.ts";
import { Invoker, RegisterOptions } from "./host/invoker.ts";
import { Context, Denops, Meta } from "../@denops/denops.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service {
  #plugins: Map<string, { denops: Denops; promise: Promise<void> }>;
  #host: Host;

  constructor(host: Host) {
    this.#plugins = new Map();
    this.#host = host;
    this.#host.register(new Invoker(this));
  }

  async register(
    name: string,
    script: string,
    meta: Meta,
    options: RegisterOptions,
  ): Promise<void> {
    const plugin = this.#plugins.get(name);
    if (plugin) {
      if (options.mode === "reload") {
        if (meta.mode === "debug") {
          console.log(
            `A denops plugin '${name}' is already registered. Reload`,
          );
        }
      } else if (options.mode === "skip") {
        if (meta.mode === "debug") {
          console.log(`A denops plugin '${name}' is already registered. Skip`);
        }
        return;
      } else {
        throw new Error(`A denops plugin '${name}' is already registered`);
      }
    }
    this.#host.call(
      "execute",
      `doautocmd <nomodeline> User DenopsWorkerPre:${name}`,
      "",
    );
    this.#host.call(
      "execute",
      `doautocmd <nomodeline> User DenopsWorkerPost:${name}`,
      "",
    );
    const mod = await import(toFileUrl(script).href);
    const denops: Denops = {
      dispatcher: {},

      get name(): string {
        return name;
      },

      get meta(): Meta {
        return meta;
      },

      call: (fn: string, ...args: unknown[]) => {
        return this.call(fn, ...args);
      },

      batch: (...calls: [string, ...unknown[]][]) => {
        return this.batch(...calls);
      },

      cmd: (cmd: string, ctx: Context = {}) => {
        return this.call("denops#api#cmd", cmd, ctx);
      },

      eval: (expr: string, ctx: Context = {}) => {
        return this.call("denops#api#eval", expr, ctx);
      },

      dispatch: (name: string, fn: string, ...args: unknown[]) => {
        return this.dispatch(name, fn, args);
      },
    };
    const promise = mod.main(denops);
    this.#plugins.set(name, {
      denops,
      promise,
    });
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#host.call(fn, ...args);
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<[unknown[], unknown]> {
    return await this.#host.batch(...calls);
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const plugin = this.#plugins.get(name);
      if (!plugin) {
        throw new Error(`No plugin '${name}' is registered`);
      }
      return await (plugin.denops.dispatcher as any)[fn](...args);
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
