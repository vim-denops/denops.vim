import {
  ensureObject,
  ensureString,
  isObject,
  isString,
  path,
  Session,
  using,
  WorkerReader,
  WorkerWriter,
} from "../deps.ts";
import { Denops, Meta } from "../../../@denops/denops.ts";
import { DenopsImpl } from "../../../@denops/denops.ts";

// deno-lint-ignore no-explicit-any
const worker = self as any as Worker;

async function main(name: string, script: string, meta: Meta): Promise<void> {
  const reader = new WorkerReader(worker);
  const writer = new WorkerWriter(worker);
  const mod = await import(path.toFileUrl(script).href);
  await using(
    new Session(reader, writer, {}, {
      errorCallback(e) {
        if (e.name === "Interrupted") {
          return;
        }
        console.error(`Unexpected error occurred in '${name}'`, e);
      },
    }),
    async (session) => {
      const denops: Denops = new DenopsImpl(name, meta, session);
      await denops.call(
        "execute",
        `doautocmd <nomodeline> User DenopsPluginPre:${name}`,
        "",
      );
      await mod.main(denops);
      await denops.call(
        "execute",
        `doautocmd <nomodeline> User DenopsPluginPost:${name}`,
        "",
      );
      await session.waitClosed();
    },
  );
  worker.terminate();
}

function isMeta(v: unknown): v is Meta {
  if (!isObject(v)) {
    return false;
  }
  if (!isString(v.mode) || !["release", "debug", "test"].includes(v.mode)) {
    return false;
  }
  if (!isString(v.host) || !["vim", "nvim"].includes(v.host)) {
    return false;
  }
  if (!isString(v.version)) {
    return false;
  }
  if (
    !isString(v.platform) || !["windows", "mac", "linux"].includes(v.platform)
  ) {
    return false;
  }
  return true;
}

// Wait startup arguments and start 'main'
worker.addEventListener("message", (event: MessageEvent<unknown>) => {
  ensureObject(event.data);
  ensureString(event.data.name);
  ensureString(event.data.script);
  if (!isMeta(event.data.meta)) {
    throw new Error(`Invalid 'meta' is passed: ${event.data.meta}`);
  }
  const { name, script, meta } = event.data;
  main(name, script, meta).catch((e) => {
    console.error(`Unexpected error occured in '${name}' (${script}): ${e}`);
  });
}, { once: true });
