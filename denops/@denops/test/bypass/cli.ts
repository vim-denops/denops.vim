import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.4/mod.ts#^";
import { BatchError, Denops } from "../../mod.ts";

function unimplemented(): never {
  throw new Error("unimplemented");
}

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    hello(name: unknown): Promise<unknown> {
      return Promise.resolve(`Hello ${name}`);
    },
  };
  const addr = JSON.parse(Deno.env.get("DENOPS_TEST_ADDRESS") || "");
  const conn = await Deno.connect(addr);
  // Build a service session defined in `@denops-private/service.ts` MANUALLY here
  // because we should not rely on private API from public API.
  const session = new Session(conn, conn, {
    async call(fn: unknown, ...args: unknown[]): Promise<unknown> {
      // deno-lint-ignore no-explicit-any
      return await denops.call(fn as any, ...args);
    },

    async batch(...calls: unknown[]): Promise<unknown> {
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

    async dispatch(
      name: unknown,
      fn: unknown,
      args: unknown,
    ): Promise<unknown> {
      // deno-lint-ignore no-explicit-any
      return await denops.dispatch(name as any, fn as any, args as any);
    },
  });
  await session.waitClosed();
}
