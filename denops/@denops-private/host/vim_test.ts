import {
  assertEquals,
  assertMatch,
  assertRejects,
} from "https://deno.land/std@0.214.0/assert/mod.ts";
import {
  assertSpyCall,
  stub,
} from "https://deno.land/std@0.214.0/testing/mock.ts";
import { delay } from "https://deno.land/std@0.214.0/async/mod.ts";
import { promiseState } from "https://deno.land/x/async@v2.1.0/mod.ts";
import { usingResource } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
import { withVim } from "../testutil/with.ts";
import { Service } from "../host.ts";
import { Vim } from "./vim.ts";
import { unimplemented } from "https://deno.land/x/errorutil@v0.1.1/mod.ts";

Deno.test("Vim", async (t) => {
  let waitClosed: Promise<void> | undefined;
  await withVim({
    fn: async (reader, writer) => {
      const service: Service = {
        bind: () => unimplemented(),
        load: () => unimplemented(),
        reload: () => unimplemented(),
        dispatch: () => unimplemented(),
        dispatchAsync: () => unimplemented(),
      };

      await usingResource(new Vim(reader, writer), async (host) => {
        await t.step(
          "'invoke' message before init throws error",
          async () => {
            await assertRejects(
              () =>
                host.call(
                  "denops#_internal#test#request",
                  "invoke",
                  ["reload", ["dummy"]],
                ),
              Error,
              "Failed to call",
            );
          },
        );

        await t.step("init() calls Service.bind()", async () => {
          const s = stub(service, "bind");
          try {
            await host.init(service);
            assertSpyCall(s, 0, { args: [host] });
          } finally {
            s.restore();
          }
        });

        await t.step("redraw() does nothing", async () => {
          await host.redraw();
          // To avoid 'async operation to op_write_all was started before this test, ...' error.
          await delay(10);
        });

        await t.step("call() returns a result of the function", async () => {
          const result = await host.call("abs", -4);
          assertEquals(result, 4);
        });

        await t.step(
          "call() throws an error when failed to call the function",
          async () => {
            await assertRejects(
              () => host.call("@@@@@", -4),
              Error,
              "Failed to call @@@@@(-4): Vim(let):E117: Unknown function: @@@@@",
            );
          },
        );

        await t.step("batch() returns results of the functions", async () => {
          const [ret, err] = await host.batch(
            ["abs", -4],
            ["abs", 10],
            ["abs", -9],
          );
          assertEquals(ret, [4, 10, 9]);
          assertEquals(err, "");
        });

        await t.step(
          "batch() returns resutls with an error when failed to call the function",
          async () => {
            const [ret, err] = await host.batch(
              ["abs", -4],
              ["abs", 10],
              ["@@@@@", -9],
            );
            assertEquals(ret, [4, 10]);
            assertMatch(
              err,
              /Failed to call @@@@@\(-9\): Vim\(.*\):E117: Unknown function: @@@@@/,
            );
          },
        );

        await t.step("notify() calls the function", () => {
          host.notify("abs", -4);
          host.notify("@@@@@", -4); // should not throw
        });

        await t.step(
          "'void' message does nothing",
          async () => {
            await host.call(
              "denops#_internal#test#request",
              "void",
              [],
            );
          },
        );

        await t.step(
          "'invoke' message calls Service method",
          async () => {
            const s = stub(service, "reload");
            try {
              await host.call(
                "denops#_internal#test#request",
                "invoke",
                ["reload", ["dummy"]],
              );
              assertSpyCall(s, 0, { args: ["dummy"] });
            } finally {
              s.restore();
            }
          },
        );

        await t.step(
          "waitClosed() returns a promise that is pending when the session is not closed",
          async () => {
            waitClosed = host.waitClosed();
            assertEquals(await promiseState(waitClosed), "pending");
          },
        );
      });
    },
  });
  await t.step(
    "waitClosed promise is fulfilled when the session is closed",
    async () => {
      assertEquals(await promiseState(waitClosed!), "fulfilled");
    },
  );
});
