import { compareVersions } from "https://deno.land/x/compare_versions@0.4.0/mod.ts#^";
import {
  assertArray,
  assertBoolean,
  assertString,
  isArray,
  isString,
  isUndefined,
} from "https://deno.land/x/unknownutil@v2.1.0/mod.ts#^";
import {
  Dispatcher as SessionDispatcher,
  Session,
  SessionOptions,
} from "https://deno.land/x/msgpack_rpc@v3.1.6/mod.ts#^";
import {
  WorkerReader,
  WorkerWriter,
} from "https://deno.land/x/workerio@v1.4.4/mod.ts#^";
import { Disposable } from "https://deno.land/x/disposable@v1.1.0/mod.ts#^";
import { responseTimeout } from "./defs.ts";
import { Host } from "./host/base.ts";
import { Invoker, RegisterOptions, ReloadOptions } from "./host/invoker.ts";
import type { Meta } from "../@denops/mod.ts";

const workerScript = "./worker/script.ts";

// Prior to Deno v1.22.0, `Deno` namespace is not available on Worker
// https://deno.com/blog/v1.22#deno-namespace-is-available-in-workers-by-default
// deno-lint-ignore no-explicit-any
const workerOptions: any = compareVersions(Deno.version.deno, "1.22.0") === -1
  ? { deno: { namespace: true } }
  : {};

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements Disposable {
  #plugins: Map<string, { script: string; worker: Worker; session: Session }>;
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
        ...workerOptions,
      },
    );
    worker.postMessage({ name, script, meta });
    const session = buildServiceSession(
      name,
      meta,
      new WorkerReader(worker),
      new WorkerWriter(worker),
      this,
      {
        responseTimeout,
      },
    );
    this.#plugins.set(name, {
      script,
      session,
      worker,
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
      return await plugin.session.call(fn, ...args);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e.toString()}`;
    }
  }

  dispose(): void {
    // Dispose all sessions
    for (const plugin of this.#plugins.values()) {
      plugin.session.dispose();
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
  reader: Deno.Reader & Deno.Closer,
  writer: Deno.Writer,
  service: Service,
  options?: SessionOptions,
) {
  const dispatcher: SessionDispatcher = {
    reload: () => {
      service.reload(name, meta, {
        mode: "skip",
      });
      return Promise.resolve();
    },

    redraw: async (force) => {
      if (!isUndefined(force)) {
        assertBoolean(force);
      }
      return await service.host.redraw(force);
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
  return new Session(reader, writer, dispatcher, options);
}

function isCall(call: unknown): call is [string, ...unknown[]] {
  return isArray(call) && call.length > 0 && isString(call[0]);
}
