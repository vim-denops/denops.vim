import { toFileUrl } from "https://deno.land/std@0.113.0/path/mod.ts";
import {
  ensureObject,
  ensureString,
  isObject,
  isString,
} from "https://deno.land/x/unknownutil@v1.1.4/mod.ts#^";
import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.4/mod.ts#^";
import { using } from "https://deno.land/x/disposable@v1.0.2/mod.ts#^";
import {
  WorkerReader,
  WorkerWriter,
} from "https://deno.land/x/workerio@v1.4.3/mod.ts#^";
import { responseTimeout } from "../defs.ts";
import type { Denops, Meta } from "../../@denops/mod.ts";
import { DenopsImpl } from "../../@denops/impl.ts";

const worker = self as unknown as Worker;

async function main(name: string, script: string, meta: Meta): Promise<void> {
  const reader = new WorkerReader(worker);
  const writer = new WorkerWriter(worker);
  const mod = await import(toFileUrl(script).href);
  await using(
    new Session(reader, writer, {}, {
      responseTimeout,
      errorCallback(e) {
        if (e.name === "Interrupted") {
          return;
        }
        console.error(`Unexpected error occurred in '${name}'`, e);
      },
    }),
    async (session) => {
      const denops: Denops = new DenopsImpl(name, meta, session);
      await denops.cmd(`doautocmd <nomodeline> User DenopsPluginPre:${name}`)
        .catch((e) =>
          console.warn(`Failed to emit DenopsPluginPre:${name}: ${e}`)
        );
      try {
        await mod.main(denops);
      } catch (e) {
        console.error(`Failed to initialize plugin ${name}: ${e}`);
        return;
      } finally {
        await denops.cmd(`doautocmd <nomodeline> User DenopsPluginPost:${name}`)
          .catch((e) =>
            console.warn(`Failed to emit DenopsPluginPost:${name}: ${e}`)
          );
      }
      await session.waitClosed();
    },
  );
  self.close();
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
