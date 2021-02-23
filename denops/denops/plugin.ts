import { Host } from "./host/base.ts";
import {
  Api,
  DispatcherFrom,
  fs,
  isContext,
  path,
  Session,
  WorkerReader,
  WorkerWriter,
} from "./deps.ts";

export interface Plugin {
  readonly name: string;
  readonly script: string;
}

async function runtimepath(host: Host): Promise<string[]> {
  const rtp = await host.eval("&runtimepath", {});
  if (typeof rtp !== "string") {
    throw new Error("runtimepath is not a string");
  }
  return rtp.split(",");
}

export async function* iterPlugins(
  host: Host,
): AsyncGenerator<Plugin, void, unknown> {
  const rtp = await runtimepath(host);
  for (const root of rtp) {
    for await (
      const entry of fs.expandGlob(
        path.join(root, "denops", "*", "mod.ts"),
      )
    ) {
      const name = path.basename(path.dirname(entry.path));
      yield {
        name,
        script: entry.path,
      };
    }
  }
}

export function runPlugin(host: Host, plugin: Plugin): Session {
  const dispatcher: DispatcherFrom<Api> = {
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

    async call(func: unknown, ...args: unknown[]): Promise<unknown> {
      if (typeof func !== "string") {
        throw new Error(
          `'func' in 'call()' of '${plugin.name}' plugin must be a string`,
        );
      }
      return await host.call(func, ...args);
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
