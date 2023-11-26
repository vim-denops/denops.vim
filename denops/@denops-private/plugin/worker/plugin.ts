import { assert, is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import {
  Client,
  Session,
} from "https://deno.land/x/messagepack_rpc@v2.0.3/mod.ts";
import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts";
import { errorDeserializer, errorSerializer } from "../../error.ts";
import type { Service } from "../../service.ts";
import type { Plugin } from "../base.ts";

const workerScript = "./worker.ts";

export class WorkerPlugin implements Plugin {
  #worker: Worker;
  #session: Session;
  #client: Client;

  readonly name: string;
  readonly script: string;

  constructor(name: string, script: string, service: Service) {
    this.name = name;
    this.script = script;
    this.#worker = new Worker(
      new URL(workerScript, import.meta.url).href,
      {
        name,
        type: "module",
      },
    );
    // Import module with fragment so that reload works properly
    // https://github.com/vim-denops/denops.vim/issues/227
    const suffix = `#${performance.now()}`;
    this.#worker.postMessage({
      scriptUrl: `${script}${suffix}`,
      meta: service.meta,
    });
    this.#session = buildSession(
      name,
      readableStreamFromWorker(this.#worker),
      writableStreamFromWorker(this.#worker),
      service,
    );
    this.#client = new Client(this.#session, { errorDeserializer });
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.#client.call(fn, ...args);
  }

  dispose(): void {
    this.#session.shutdown().catch(() => {
      // Do nothing
    });
    this.#worker.terminate();
  }
}

function buildSession(
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
