import { Service } from "./service.ts";
import { Api, isContext } from "./api.ts";
import {
  DispatcherFrom,
  path,
  Session,
  WorkerReader,
  WorkerWriter,
} from "./deps.ts";

export interface Plugin {
  readonly name: string;
  readonly script: string;
}

export function runPlugin(service: Service, plugin: Plugin): Session {
  const host = service.host;
  const dispatcher: DispatcherFrom<Api> = {
    async dispatch(
      name: unknown,
      method: unknown,
      params: unknown,
    ): Promise<unknown> {
      if (typeof name !== "string") {
        throw new Error(
          `'name' in 'dispatch()' of '${plugin.name}' plugin must be a string`,
        );
      }
      if (typeof method !== "string") {
        throw new Error(
          `'method' in 'dispatch()' of '${plugin.name}' plugin must be a string`,
        );
      }
      if (!Array.isArray(params)) {
        throw new Error(
          `'params' in 'dispatch()' of '${plugin.name}' plugin must be an array`,
        );
      }
      return await service.dispatch(name, method, params);
    },

    async call(func: unknown, ...args: unknown[]): Promise<unknown> {
      if (typeof func !== "string") {
        throw new Error(
          `'func' in 'call()' of '${plugin.name}' plugin must be a string`,
        );
      }
      return await host.call(func, ...args);
    },

    async cmd(cmd: unknown, context: unknown): Promise<void> {
      if (typeof cmd !== "string") {
        throw new Error(
          `'cmd' in 'cmd()' of '${plugin.name}' plugin must be a string`,
        );
      }
      if (!isContext(context)) {
        throw new Error(
          `'context' in 'cmd()' of '${plugin.name}' plugin must be a context object`,
        );
      }
      await host.cmd(cmd, context);
    },

    async eval(expr: unknown, context: unknown): Promise<unknown> {
      if (typeof expr !== "string") {
        throw new Error(
          `'expr' in 'eval()' of '${plugin.name}' plugin must be a string`,
        );
      }
      if (!isContext(context)) {
        throw new Error(
          `'context' in 'eval()' of '${plugin.name}' plugin must be a context object`,
        );
      }
      return await host.eval(expr, context);
    },
  };

  const worker = new Worker(
    new URL(path.toFileUrl(plugin.script).href, import.meta.url).href,
    {
      name: plugin.name,
      type: "module",
      deno: {
        namespace: true,
      },
    },
  );
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
