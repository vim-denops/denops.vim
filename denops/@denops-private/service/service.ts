import {
  ensureArray,
  ensureString,
  isArray,
  isString,
  Session,
  WorkerReader,
  WorkerWriter,
} from "./deps.ts";
import { responseTimeout } from "./defs.ts";
import { Host } from "./host/base.ts";
import { Invoker, RegisterOptions } from "./host/invoker.ts";
import { Meta } from "../../@denops/denops.ts";

const workerScript = "./worker/script.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service {
  #plugins: Map<string, { worker: Worker; session: Session }>;
  #host: Host;

  constructor(host: Host) {
    this.#plugins = new Map();
    this.#host = host;
    this.#host.register(new Invoker(this));
  }

  register(
    name: string,
    script: string,
    meta: Meta,
    options: RegisterOptions,
  ): void {
    const plugin = this.#plugins.get(name);
    if (plugin) {
      if (options.mode === "reload") {
        if (meta.mode === "debug") {
          console.log(
            `A denops plugin '${name}' is already registered. Reload`,
          );
        }
        plugin.worker.terminate();
      } else if (options.mode === "skip") {
        if (meta.mode === "debug") {
          console.log(`A denops plugin '${name}' is already registered. Skip`);
        }
        return;
      } else {
        throw new Error(`A denops plugin '${name}' is already registered`);
      }
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
    const session = new Session(reader, writer, {
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
    }, {
      responseTimeout,
    });
    this.#plugins.set(name, {
      session,
      worker,
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
      return await plugin.session.call(fn, ...args);
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
