import { toFileUrl } from "https://deno.land/std@0.192.0/path/mod.ts";
import {
  assertArray,
  assertBoolean,
  assertString,
  isArray,
  isNullish,
  isString,
} from "https://deno.land/x/unknownutil@v2.1.1/mod.ts#^";
import {
  Client,
  Session,
} from "https://deno.land/x/messagepack_rpc@v2.0.0/mod.ts#^";
import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts#^";
import { Disposable } from "https://deno.land/x/disposable@v1.1.1/mod.ts#^";
import { Host } from "./host/base.ts";
import { Invoker, RegisterOptions, ReloadOptions } from "./host/invoker.ts";
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
    const scriptUrl = resolveScriptUrl(script);
    worker.postMessage({ scriptUrl, meta });
    const session = buildServiceSession(
      name,
      meta,
      readableStreamFromWorker(worker),
      writableStreamFromWorker(worker),
      this,
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
    });
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

  dispose(): void {
    // Dispose all sessions
    for (const plugin of this.#plugins.values()) {
      plugin.session.shutdown();
    }
    // Terminate all workers
    for (const plugin of this.#plugins.values()) {
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
) {
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
    reload: () => {
      service.reload(name, meta, {
        mode: "skip",
      });
      return Promise.resolve();
    },

    redraw: async (force) => {
      if (!isNullish(force)) {
        assertBoolean(force);
      }
      return await service.host.redraw(!!force);
    },

    call: async (fn, ...args) => {
      assertString(fn);
      assertArray(args);
      return await service.host.call(fn, ...args);
    },

    batch: async (...calls) => {
      assertArray(calls, isCall);
      return await service.host.batch(...calls);
    },

    dispatch: async (name, fn, ...args) => {
      assertString(name);
      assertString(fn);
      assertArray(args);
      return await service.dispatch(name, fn, args);
    },
  };
  session.start();
  return session;
}

function isCall(call: unknown): call is [string, ...unknown[]] {
  return isArray(call) && call.length > 0 && isString(call[0]);
}

function resolveScriptUrl(script: string): string {
  try {
    return toFileUrl(script).href;
  } catch {
    return new URL(script, import.meta.url).href;
  }
}
