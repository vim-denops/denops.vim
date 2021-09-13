import type { Denops } from "../@denops/mod.ts";
import type { ServiceDispatcher } from "../@denops-private/service.ts";
import { responseTimeout } from "../@denops-private/defs.ts";
import {
  ensureArray,
  ensureString,
  isArray,
  isString,
  Session,
} from "../@denops-private/deps.ts";

export async function main(denops: Denops) {
  const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0, // Automatically select free port
  });
  const addr = listener.addr as Deno.NetAddr;
  await denops.cmd(`let $DENOPS_LISTEN_ADDRESS = address`, {
    address: `${addr.hostname}:${addr.port}`
  });
  for await (const conn of listener) {
    handle(denops, conn).catch((e) => {
      console.error(`[remote-denops] Unexpected error occurred: ${e}`);
    });
  }
}

function handle(denops: Denops, conn: Deno.Conn): Promise<void> {
  const dispatcher: ServiceDispatcher = {
    async call(fn, ...args) {
      ensureString(fn);
      ensureArray(args);
      return await denops.call(fn, ...args);
    },

    async batch(...calls) {
      const isCall = (call: unknown): call is [string, ...unknown[]] =>
        isArray(call) && call.length > 0 && isString(call[0]);
      ensureArray(calls, isCall);
      return await denops.batch(...calls);
    },

    async dispatch(name, fn, ...args) {
      ensureString(name);
      ensureString(fn);
      ensureArray(args);
      return await denops.dispatch(name, fn, args);
    },
  };
  const session = new Session(conn, conn, dispatcher, {
    responseTimeout,
  });
  return session.waitClosed();
}
