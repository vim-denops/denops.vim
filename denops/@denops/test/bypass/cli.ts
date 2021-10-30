import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.4/mod.ts#^";
import { Denops } from "../../types.ts";
import { BatchError } from "../../errors.ts";

export async function main(denops: Denops): Promise<void> {
  const addr = JSON.parse(Deno.env.get("DENOPS_TEST_ADDRESS") || "");
  const conn = await Deno.connect(addr);
  const session = new Session(conn, conn, {
    call: async (fn: unknown, ...args: unknown[]): Promise<unknown> => {
      // deno-lint-ignore no-explicit-any
      return await denops.call(fn as any, ...args);
    },

    batch: async (...calls: unknown[]): Promise<unknown> => {
      try {
        // deno-lint-ignore no-explicit-any
        return [await denops.batch(...calls as any), ""];
      } catch (e) {
        if (e instanceof BatchError) {
          return [e.results, e.message];
        }
        return [[], `${e}`];
      }
    },
  });
  await session.waitClosed();
}
