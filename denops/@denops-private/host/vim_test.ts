import {
  assertEquals,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@0.225.1";
import { assertSpyCall, stub } from "jsr:@std/testing@0.224.0/mock";
import { delay } from "jsr:@std/async@0.224.0/delay";
import { promiseState } from "jsr:@lambdalisue/async@2.1.1";
import { unimplemented } from "jsr:@lambdalisue/errorutil@1.0.0";
import { withVim } from "../testutil/with.ts";
import type { Service } from "../host.ts";
import { Vim } from "./vim.ts";

Deno.test("Vim", async (t) => {
  let waitClosed: Promise<void> | undefined;
  await withVim({
    fn: async (reader, writer) => {
      const service: Service = {
        bind: () => unimplemented(),
        load: () => unimplemented(),
        reload: () => unimplemented(),
        interrupt: () => unimplemented(),
        dispatch: () => unimplemented(),
        dispatchAsync: () => unimplemented(),
      };

      await using host = new Vim(reader, writer);
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
        using s = stub(service, "bind");
        await host.init(service);
        assertSpyCall(s, 0, { args: [host] });
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
            "Failed to call '@@@@@' in Vim: Vim(let):E117: Unknown function: @@@@@",
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
            /Failed to call '@@@@@' in Vim: Vim\(.*\):E117: Unknown function: @@@@@/,
          );
        },
      );

      await t.step("notify() calls the function", () => {
        host.notify("abs", -4);
      });

      await t.step(
        "notify() does not throws if calls a non-existent function",
        () => {
          host.notify("@@@@@", -4); // should not throw
        },
      );

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
          using s = stub(service, "reload");
          await host.call(
            "denops#_internal#test#request",
            "invoke",
            ["reload", ["dummy"]],
          );
          assertSpyCall(s, 0, { args: ["dummy"] });
        },
      );

      await t.step(
        "waitClosed() returns a promise that is pending when the session is not closed",
        async () => {
          waitClosed = host.waitClosed();
          assertEquals(await promiseState(waitClosed), "pending");
        },
      );
    },
  });
  await t.step(
    "waitClosed promise is fulfilled when the session is closed",
    async () => {
      assertEquals(await promiseState(waitClosed!), "fulfilled");
    },
  );
});
