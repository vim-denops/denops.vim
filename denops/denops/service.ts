import { Host } from "./host/base.ts";
import {
  Api,
  DispatcherFrom,
  isContext,
  Session,
  WorkerReader,
  WorkerWriter,
} from "./deps.ts";

export class Service {
  #plugins: { [key: string]: Session };
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
      throw `${e.stack ?? e.toString()}`;
    }
  }
}

function runPlugin(name: string, script: string, host: Host): Session {
  const dispatcher: DispatcherFrom<Api> = {
    async cmd(cmd: unknown, context: unknown): Promise<void> {
      if (typeof cmd !== "string") {
        throw new Error(
          `'cmd' in 'cmd()' of '${name}' plugin must be a string`,
        );
      }
      if (!isContext(context)) {
        throw new Error(
          `'context' in 'cmd()' of '${name}' plugin must be a context object`,
        );
      }
      await host.cmd(cmd, context);
    },

    async eval(expr: unknown, context: unknown): Promise<void> {
      if (typeof expr !== "string") {
        throw new Error(
          `'expr' in 'eval()' of '${name}' plugin must be a string`,
        );
      }
      if (!isContext(context)) {
        throw new Error(
          `'context' in 'eval()' of '${name}' plugin must be a context object`,
        );
      }
      await host.eval(expr, context);
    },

    async call(func: unknown, ...args: unknown[]): Promise<unknown> {
      if (typeof func !== "string") {
        throw new Error(
          `'func' in 'call()' of '${name}' plugin must be a string`,
        );
      }
      return await host.call(func, ...args);
    },
  };

  const worker = new Worker(new URL(script, import.meta.url).href, {
    name,
    type: "module",
    deno: {
      namespace: true,
    },
  });
  const reader = new WorkerReader(worker);
  const writer = new WorkerWriter(worker);
  const session = new Session(reader, writer, dispatcher);

  session
    .listen()
    .then()
    .catch((e: Error) => {
      console.error("Plugin server is closed with error:", e);
    });

  return session;
}
