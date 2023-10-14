import { deferred } from "https://deno.land/std@0.194.0/async/mod.ts";
import { toFileUrl } from "https://deno.land/std@0.194.0/path/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.2.0/mod.ts#^";
import {
  Client,
  Session,
} from "https://deno.land/x/messagepack_rpc@v2.0.3/mod.ts#^";
import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts#^";
import { Disposable } from "https://deno.land/x/disposable@v1.1.1/mod.ts#^";
import { Host } from "./host/base.ts";
import { Invoker, LoadOptions, RegisterOptions } from "./host/invoker.ts";
import { traceReadableStream, traceWritableStream } from "./trace_stream.ts";
import { errorDeserializer, errorSerializer } from "./error.ts";
import type { Meta } from "../@denops/mod.ts";

const workerScript = "./worker/script.ts";

type Loaded = {
  worker: Worker;
  session: Session;
  client: Client;
};

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements Disposable {
  #plugins: Map<string, {
    script: string;
    loaded?: Promise<Loaded>;
  }>;
  host: Host;
  meta: Promise<Meta>;

  constructor(host: Host) {
    this.#plugins = new Map();
    this.host = host;
    this.host.register(new Invoker(this));
    this.meta = this.host.call("denops#_internal#meta#get") as Promise<Meta>;
  }

  /** @deprecated */
  async register(
    name: string,
    script: string,
    options: RegisterOptions,
    trace: boolean,
  ): Promise<void> {
    const meta = await this.meta;
    const plugin = this.#plugins.get(name);
    if (plugin) {
      if (options.mode === "reload") {
        if (meta.mode === "debug") {
          console.log(
            `A denops plugin '${name}' is already registered. Reload`,
          );
        }
        plugin.loaded?.then(({ session, worker }) => {
          session.shutdown();
          worker.terminate();
        });
      } else if (options.mode === "skip") {
        if (meta.mode === "debug") {
          console.log(`A denops plugin '${name}' is already registered. Skip`);
        }
        return;
      } else {
        throw new Error(`A denops plugin '${name}' is already registered`);
      }
    }
    this.define(name, script);
    await this.load(name, { trace, reload: options.mode === "reload" });
  }

  define(name: string, script: string): void {
    const plugin = this.#plugins.get(name);
    plugin?.loaded?.then(({ session, worker }) => {
      session.shutdown();
      worker.terminate();
    });
    this.#plugins.set(name, { script });
  }

  load(name: string, { reload, trace }: LoadOptions): Promise<Loaded> {
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      throw new Error(`No denops plugin '${name}' is defined`);
    }
    if (plugin.loaded && !reload) {
      return plugin.loaded;
    }
    plugin.loaded?.then(({ session, worker }) => {
      session.shutdown();
      worker.terminate();
    });
    plugin.loaded = (async () => {
      const worker = new Worker(
        new URL(workerScript, import.meta.url).href,
        {
          name,
          type: "module",
        },
      );
      const meta = await this.meta;
      const scriptUrl = resolveScriptUrl(plugin.script);
      worker.postMessage({
        // Import module with fragment so that reload works properly
        // https://github.com/vim-denops/denops.vim/issues/227
        scriptUrl: `${scriptUrl}#${performance.now()}`,
        meta,
        trace,
      });
      const session = await buildServiceSession(
        name,
        readableStreamFromWorker(worker),
        writableStreamFromWorker(worker),
        this,
        trace ?? false,
      );
      return {
        worker,
        session,
        client: new Client(session, { errorDeserializer }),
      };
    })();
    return plugin.loaded;
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const { client } = await this.load(name, { reload: false });
      return client.call(fn, ...args);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e.toString()}`;
    }
  }

  dispose(): void {
    for (const plugin of this.#plugins.values()) {
      plugin.loaded?.then(({ session, worker }) => {
        session.shutdown();
        worker.terminate();
      });
    }
  }
}

async function buildServiceSession(
  name: string,
  reader: ReadableStream<Uint8Array>,
  writer: WritableStream<Uint8Array>,
  service: Service,
  trace: boolean,
): Promise<Session> {
  if (trace) {
    reader = traceReadableStream(reader, { prefix: "worker -> denops: " });
    writer = traceWritableStream(writer, { prefix: "denops -> worker: " });
  }
  const waiter = deferred<void>();
  const session = new Session(reader, writer, {
    errorSerializer,
  });
  session.onMessageError = (error, message) => {
    if (error instanceof Error && error.name === "Interrupted") {
      return;
    }
    console.error(`Failed to handle message ${message}`, error);
  };
  session.dispatcher = {
    reload: async (trace) => {
      assert(trace, is.Boolean);
      await service.load(name, { trace, reload: true });
      return Promise.resolve();
    },

    ready: () => {
      waiter.resolve();
      return Promise.resolve();
    },

    redraw: async (force) => {
      assert(force, is.OneOf([is.Boolean, is.Nullish]));
      return await service.host.redraw(!!force);
    },

    call: async (fn, ...args) => {
      assert(fn, is.String);
      assert(args, is.Array);
      return await service.host.call(fn, ...args);
    },

    batch: async (...calls) => {
      assert(calls, is.ArrayOf(isCall));
      return await service.host.batch(...calls);
    },

    dispatch: async (name, fn, ...args) => {
      assert(name, is.String);
      assert(fn, is.String);
      assert(args, is.Array);
      return await service.dispatch(name, fn, args);
    },
  };
  session.start();
  await waiter;
  return session;
}

function isCall(call: unknown): call is [string, ...unknown[]] {
  return is.Array(call) && call.length > 0 && is.String(call[0]);
}

function resolveScriptUrl(script: string): string {
  try {
    return toFileUrl(script).href;
  } catch {
    return new URL(script, import.meta.url).href;
  }
}
