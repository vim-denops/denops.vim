import { toFileUrl } from "https://deno.land/std@0.208.0/path/mod.ts";
import {
  assert,
  ensure,
  is,
} from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import {
  Client,
  Session,
} from "https://deno.land/x/messagepack_rpc@v2.0.3/mod.ts";
import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts";
import type { Disposable } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
import type { Host } from "./host/base.ts";
import { Invoker } from "./host/invoker.ts";
import { errorDeserializer, errorSerializer } from "./error.ts";
import type { Meta } from "../@denops/mod.ts";
import { isMeta } from "./util.ts";

const workerScript = "./worker/script.ts";

type Plugin = {
  script: string;
  worker: Worker;
  session: Session;
  client: Client;
};

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements Disposable {
  #plugins: Map<string, Plugin>;
  host: Host;
  meta: Promise<Meta>;

  constructor(host: Host) {
    this.#plugins = new Map();
    this.host = host;
    this.host.register(new Invoker(this));
    this.meta = host.call("denops#_internal#meta#get").then((m) =>
      ensure(m, isMeta)
    );
  }

  async register(
    name: string,
    script: string,
  ): Promise<void> {
    const meta = await this.meta;
    const plugin = this.#plugins.get(name);
    if (plugin) {
      if (meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is already registered. Skip`);
      }
      return;
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
    worker.postMessage({ scriptUrl: `${scriptUrl}${suffix}`, meta });
    const session = buildServiceSession(
      name,
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

  async reload(name: string): Promise<void> {
    const meta = await this.meta;
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      if (meta.mode === "debug") {
        console.log(`A denops plugin '${name}' is not registered yet. Skip`);
      }
      return;
    }
    await disposePlugin(plugin);
    this.#plugins.delete(name);
    this.register(name, plugin.script);
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
    await Promise.all([...this.#plugins.values()].map(disposePlugin));
  }
}

async function disposePlugin(plugin: Plugin): Promise<void> {
  try {
    await plugin.session.shutdown();
  } catch {
    // Do nothing
  }
  plugin.worker.terminate();
}

function buildServiceSession(
  name: string,
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
    reload: (trace) => {
      assert(trace, is.Boolean);
      service.reload(name);
      return Promise.resolve();
    },

    redraw: (force) => {
      assert(force, is.OneOf([is.Boolean, is.Nullish]));
      return service.host.redraw(!!force);
    },

    call: (fn, ...args) => {
      assert(fn, is.String);
      assert(args, is.Array);
      return service.host.call(fn, ...args);
    },

    batch: (...calls) => {
      assert(calls, is.ArrayOf(isCall));
      return service.host.batch(...calls);
    },

    dispatch: (name, fn, ...args) => {
      assert(name, is.String);
      assert(fn, is.String);
      assert(args, is.Array);
      return service.dispatch(name, fn, args);
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
