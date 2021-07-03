import {
  ensureArray,
  ensureString,
  isArray,
  isString,
} from "../vendor/https/deno.land/x/unknownutil/mod.ts";
import { Session } from "../vendor/https/deno.land/x/msgpack_rpc/mod.ts";
import {
  WorkerReader,
  WorkerWriter,
} from "../vendor/https/deno.land/x/workerio/mod.ts";
import { Host } from "./host/base.ts";
import { Invoker } from "./host/invoker.ts";
import { Meta } from "../../@denops/denops.ts";

const workerScript = "./worker/script.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service {
  #plugins: Record<string, { worker: Worker; plugin: Session }>;
  #host: Host;

  constructor(host: Host) {
    this.#plugins = {};
    this.#host = host;
    this.#host.register(new Invoker(this));
  }

  register(name: string, script: string, meta: Meta): void {
    if (name in this.#plugins) {
      const { worker } = this.#plugins[name];
      worker.terminate();
    }
    const worker = new Worker(
      new URL(workerScript, import.meta.url).href,
      {
        name,
        type: "module",
        deno: {
          namespace: true,
        },
      },
    );
    worker.postMessage({ name, script, meta });
    const reader = new WorkerReader(worker);
    const writer = new WorkerWriter(worker);
    const plugin = new Session(reader, writer, {
      call: async (fn, ...args) => {
        ensureString(fn);
        ensureArray(args);
        return await this.call(fn, ...args);
      },

      batch: async (...calls) => {
        const isCall = (call: unknown): call is [string, ...unknown[]] =>
          isArray(call) && call.length > 0 && isString(call[0]);
        ensureArray(calls, isCall);
        return await this.batch(...calls);
      },

      dispatch: async (name, fn, ...args) => {
        ensureString(name);
        ensureString(fn);
        ensureArray(args);
        return await this.dispatch(name, fn, args);
      },
    });
    this.#plugins[name] = {
      plugin,
      worker,
    };
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
      const { plugin } = this.#plugins[name];
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

  waitClosed(): Promise<void> {
    return this.#host.waitClosed();
  }
}
