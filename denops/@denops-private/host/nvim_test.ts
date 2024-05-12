import {
  assertEquals,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@0.225.1";
import { assertSpyCall, stub } from "jsr:@std/testing@0.224.0/mock";
import { promiseState } from "jsr:@lambdalisue/async@2.1.1";
import { unimplemented } from "jsr:@lambdalisue/errorutil@1.0.0";
import { withNeovim } from "../testutil/with.ts";
import type { Service } from "../host.ts";
import { Neovim } from "./nvim.ts";

Deno.test("Neovim", async (t) => {
  let waitClosed: Promise<void> | undefined;
  await withNeovim({
    fn: async (reader, writer) => {
      const service: Service = {
        bind: () => unimplemented(),
        load: () => unimplemented(),
        reload: () => unimplemented(),
        dispatch: () => unimplemented(),
        dispatchAsync: () => unimplemented(),
      };

      await using host = new Neovim(reader, writer);
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
            "Failed to call @@@@@(-4): Vim:E117: Unknown function: @@@@@ (code: 0)",
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
            /Failed to call @@@@@\(-9\): Vim:E117: Unknown function: @@@@@/,
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
        "'nvim_error_event' message shows error message",
        async () => {
          const s = stub(console, "error");
          try {
            await host.call(
              "denops#_internal#test#request",
              "nvim_error_event",
              [0, "message"],
            );
            assertSpyCall(s, 0, { args: ["nvim_error_event(0)", "message"] });
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
    },
  });
  await t.step(
    "waitClosed promise is fulfilled when the session is closed",
    async () => {
      assertEquals(await promiseState(waitClosed!), "fulfilled");
    },
  );
});
