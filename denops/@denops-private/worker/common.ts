import {
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
import { Denops, DenopsImpl, Meta } from "../../@denops/denops.ts";

export type Module = {
  main(denops: unknown): Promise<void>;
};

export const worker = self as unknown as Worker;

export async function runner(
  name: string,
  mod: Module,
  meta: Meta,
): Promise<void> {
  const reader = new WorkerReader(worker);
  const writer = new WorkerWriter(worker);
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
      denops.cmd(`doautocmd <nomodeline> User DenopsPluginPre:${name}`);
      await mod.main(denops);
      denops.cmd(`doautocmd <nomodeline> User DenopsPluginPost:${name}`);
      await session.waitClosed();
    },
  );
  worker.terminate();
}

export function isMeta(v: unknown): v is Meta {
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
