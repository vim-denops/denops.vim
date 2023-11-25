import { toFileUrl } from "https://deno.land/std@0.208.0/path/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.10.0/mod.ts#^";
import {
  Client,
  Session,
} from "https://deno.land/x/messagepack_rpc@v2.0.3/mod.ts#^";
import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts#^";
import { Disposable } from "https://deno.land/x/disposable@v1.2.0/mod.ts#^";
import { Host } from "./host/base.ts";
import { Invoker, RegisterOptions, ReloadOptions } from "./host/invoker.ts";
import { traceReadableStream, traceWritableStream } from "./trace_stream.ts";
import { errorDeserializer, errorSerializer } from "./error.ts";
import type { Meta } from "../@denops/mod.ts";

const workerScript = "./worker/script.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements Disposable {
  #plugins: Map<string, {
    script: string;
    worker: Worker;
    session: Session;
    client: Client;
  }>;
  host: Host;

  constructor(host: Host) {
    this.#plugins = new Map();
    this.host = host;
    this.host.register(new Invoker(this));
  }

  register(
    name: string,
    script: string,
    meta: Meta,
    options: RegisterOptions,
    trace: boolean,
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
      },
    );
    // Import module with fragment so that reload works properly
    // https://github.com/vim-denops/denops.vim/issues/227
    const suffix = `#${performance.now()}`;
    const scriptUrl = resolveScriptUrl(script);
    worker.postMessage({ scriptUrl: `${scriptUrl}${suffix}`, meta, trace });
    const session = buildServiceSession(
      name,
      meta,
      readableStreamFromWorker(worker),
      writableStreamFromWorker(worker),
      this,
      trace,
    );
    this.#plugins.set(name, {
      script,
      worker,
      session,
      client: new Client(session, { errorDeserializer }),
    });
  }

  reload(
    name: string,
    meta: Meta,
    options: ReloadOptions,
    trace: boolean,
  ): void {
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      if (options.mode === "skip") {
        if (meta.mode === "debug") {
          console.log(`A denops plugin '${name}' is not registered yet. Skip`);
        }
        return;
      } else {
        throw new Error(`A denops plugin '${name}' is not registered yet`);
      }
    }
    this.register(name, plugin.script, { ...meta, mode: "release" }, {
      mode: "reload",
    }, trace);
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const plugin = this.#plugins.get(name);
      if (!plugin) {
        throw new Error(`No plugin '${name}' is registered`);
      }
      return await plugin.client.call(fn, ...args);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e.toString()}`;
    }
  }

  async dispose(): Promise<void> {
    for (const plugin of this.#plugins.values()) {
      try {
        await plugin.session.shutdown();
      } catch {
        // Do nothing
      }
      plugin.worker.terminate();
    }
  }
}

function buildServiceSession(
  name: string,
  meta: Meta,
  reader: ReadableStream<Uint8Array>,
  writer: WritableStream<Uint8Array>,
  service: Service,
  trace: boolean,
) {
  if (trace) {
    reader = traceReadableStream(reader, { prefix: "worker -> denops: " });
    writer = traceWritableStream(writer, { prefix: "denops -> worker: " });
  }
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
    reload: (trace) => {
      assert(trace, is.Boolean);
      service.reload(name, meta, {
        mode: "skip",
      }, trace);
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
