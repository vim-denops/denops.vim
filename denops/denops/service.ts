import { Host } from "./host/base.ts";
import { denops, msgpackRpc } from "./deps.ts";

export class Service {
  #plugins: { [key: string]: msgpackRpc.Session };
  #host: Host;

  constructor(host: Host) {
    this.#plugins = {};
    this.#host = host;
  }

  register(name: string, script: string): Promise<void> {
    try {
      this.#plugins[name] = runPlugin(name, script, this.#host);
      return Promise.resolve();
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e}`;
    }
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const session = this.#plugins[name];
      if (!session) {
        throw new Error(`No plugin '${name}' is registered`);
      }
      return await session.call(fn, ...args);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e}`;
    }
  }
}

function runPlugin(
  name: string,
  script: string,
  host: Host,
): msgpackRpc.Session {
  const dispatcher: msgpackRpc.Dispatcher = {
    async command(expr: unknown): Promise<void> {
      if (typeof expr !== "string") {
        throw new Error(
          `'expr' in 'command()' of '${name}' plugin must be a string`,
        );
      }
      await host.command(expr);
    },

    async eval(expr: unknown): Promise<unknown> {
      if (typeof expr !== "string") {
        throw new Error(
          `'expr' in 'eval()' of '${name}' plugin must be a string`,
        );
      }
      return await host.eval(expr);
    },

    async call(fn: unknown, args: unknown): Promise<unknown> {
      if (typeof fn !== "string") {
        throw new Error(
          `'fn' in 'call()' of '${name}' plugin must be a string`,
        );
      }
      if (!Array.isArray(args)) {
        throw new Error(
          `'args' in 'call()' of '${name}' plugin must be an array`,
        );
      }
      return await host.call(fn, args);
    },

    async echo(text: unknown): Promise<void> {
      if (typeof text !== "string") {
        throw new Error(
          `'text' in 'echo()' of '${name}' plugin must be a string`,
        );
      }
      await host.echo(text);
    },

    async echomsg(text: unknown): Promise<void> {
      if (typeof text !== "string") {
        throw new Error(
          `'text' in 'echomsg()' of '${name}' plugin must be a string`,
        );
      }
      await host.echomsg(text);
    },
  };

  const worker = new Worker(new URL(script, import.meta.url).href, {
    name,
    type: "module",
    deno: {
      namespace: true,
    },
  });
  const reader = new denops.WorkerReader(worker);
  const writer = new denops.WorkerWriter(worker);
  const session = new msgpackRpc.Session(reader, writer, dispatcher);

  session
    .listen()
    .then()
    .catch((e: Error) => {
      console.error("Plugin server is closed with error:", e);
    });

  return session;
}
