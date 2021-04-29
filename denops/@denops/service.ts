import { path, WorkerReader, WorkerWriter } from "./deps.ts";
import { Plugin } from "./plugin.ts";
import { Host, Invoker } from "./host/mod.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements Invoker {
  #plugins: Record<string, { worker: Worker; plugin: Plugin }>;
  #host: Host;

  constructor(host: Host) {
    this.#plugins = {};
    this.#host = host;
  }

  get host(): Host {
    return this.#host;
  }

  register(name: string, script: string): void {
    if (name in this.#plugins) {
      const { worker } = this.#plugins[name];
      worker.terminate();
    }
    const worker = new Worker(
      new URL(path.toFileUrl(script).href, import.meta.url).href,
      {
        name,
        type: "module",
        deno: {
          namespace: true,
        },
      },
    );
    const reader = new WorkerReader(worker);
    const writer = new WorkerWriter(worker);
    const plugin = new Plugin(reader, writer, this);
    this.#plugins[name] = {
      plugin,
      worker,
    };
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

  dispatchAsync(
    name: string,
    fn: string,
    args: unknown[],
    success: string, // Callback ID
    failure: string, // Callback ID
  ): Promise<void> {
    this.dispatch(name, fn, args)
      .then((r) => this.#host.call("denops#callback#call", success, r))
      .catch((e) => this.#host.call("denops#callback#call", failure, e))
      .catch((e) => {
        console.error(`${e.stack ?? e.toString()}`);
      });
    return Promise.resolve();
  }
}
