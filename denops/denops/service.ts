import { Host } from "./host/base.ts";
import { denops, msgpackRpc } from "./deps.ts";

export class Service {
  #plugins: { [key: string]: msgpackRpc.Session };
  #host: Host;

  constructor(host: Host) {
    this.#plugins = {};
    this.#host = host;
  }

  async echo(text: string): Promise<string> {
    return await Promise.resolve(`${text}`);
  }

  async register(name: string, script: string): Promise<void> {
    await this.#host.debug(`Register '${name}' (${script})`);
    try {
      this.#plugins[name] = runPlugin(name, script, this.#host);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e}`;
    }
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    await this.#host.debug(`Dispatch '${fn}' in '${name}'`);
    const session = this.#plugins[name];
    if (!session) {
      throw new Error(`No plugin '${name}' is registered`);
    }
    try {
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
        throw new Error(`'expr' must be a string`);
      }
      await host.command(expr);
    },

    async eval(expr: unknown): Promise<unknown> {
      if (typeof expr !== "string") {
        throw new Error(`'expr' must be a string`);
      }
      return await host.eval(expr);
    },

    async call(fn: unknown, args: unknown): Promise<unknown> {
      if (typeof fn !== "string") {
        throw new Error(`'fn' must be a string`);
      }
      if (!Array.isArray(args)) {
        throw new Error(`'args' must be a string`);
      }
      return await host.call(fn, args);
    },

    async debug(...params: unknown[]): Promise<void> {
      await host.debug(...params);
    },

    async info(...params: unknown[]): Promise<void> {
      await host.info(...params);
    },

    async error(...params: unknown[]): Promise<void> {
      await host.error(...params);
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
    .catch(async (e: Error) => {
      await host.error("[denops] Plugin server is closed with error:", e);
    });

  return session;
}
