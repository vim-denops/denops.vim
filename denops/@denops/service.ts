import { Api } from "./api.ts";
import { Host } from "./host/mod.ts";
import { Session, DispatcherFrom } from "./deps.ts";
import { ensureArray, ensureRecord, ensureString } from "./utils.ts";
import { path, WorkerReader, WorkerWriter } from "./deps.ts";

export class Service {
  #plugins: Record<string, Session>;
  #host: Host;

  constructor(host: Host) {
    this.#plugins = {};
    this.#host = host;
  }

  get host(): Host {
    return this.#host;
  }

  register(name: string, script: string): void {
    if (this.#plugins[name]) {
      return;
    }
    const worker = new Worker(
      new URL(path.toFileUrl(script).href, import.meta.url).href,
      {
        name: name,
        type: "module",
        deno: {
          namespace: true,
        },
      },
    );
    const reader = new WorkerReader(worker);
    const writer = new WorkerWriter(worker);
    const session = new Session(reader, writer, buildDispatcher(this));
    session
      .listen()
      .then()
      .catch((e: Error) => {
        console.error("Plugin server is closed with error:", e);
      });

    this.#plugins[name] = session;
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const plugin = this.#plugins[name];
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

function buildDispatcher(service: Service): DispatcherFrom<Api> {
  const host = service.host;
  const dispatcher: DispatcherFrom<Api> = {
    async dispatch(
      name: unknown,
      fn: unknown,
      args: unknown,
    ): Promise<unknown> {
      ensureString(name, 'name');
      ensureString(fn, 'fn');
      ensureArray(args, 'args');
      return await service.dispatch(name, fn, args);
    },
    async call(fn: unknown, ...args: unknown[]): Promise<unknown> {
      ensureString(fn, 'fn');
      ensureArray(args, 'args');
      return await host.call(fn, ...args);
    },
    async cmd(cmd: unknown, ctx: unknown): Promise<void> {
      ensureString(cmd, 'cmd');
      ensureRecord(ctx, 'ctx');
      await host.cmd(cmd, ctx);
    },
    async eval(expr: unknown, ctx: unknown): Promise<unknown> {
      ensureString(expr, 'expr');
      ensureRecord(ctx, 'ctx');
      return await host.eval(expr, ctx);
    },
  };
  return dispatcher;
}
