import {
  assertEquals,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@^1.0.1";
import {
  assertSpyCallArgs,
  assertSpyCalls,
  resolvesNext,
  stub,
} from "jsr:@std/testing@^1.0.0-rc.5/mock";
import { delay } from "jsr:@std/async@^1.0.1/delay";
import { promiseState } from "jsr:@lambdalisue/async@^2.1.1";
import { unimplemented } from "jsr:@lambdalisue/errorutil@^1.1.0";
import { Client, Session } from "jsr:@denops/vim-channel-command@^4.0.2";
import { withVim } from "/denops-testutil/with.ts";
import type { Service } from "../host.ts";
import { Vim } from "./vim.ts";

const NOTIFY_DELAY = 100;

Deno.test("Vim", async (t) => {
  await withVim({
    fn: async ({ reader, writer }) => {
      const service: Service = {
        bind: () => unimplemented(),
        load: () => unimplemented(),
        unload: () => unimplemented(),
        reload: () => unimplemented(),
        interrupt: () => unimplemented(),
        dispatch: () => unimplemented(),
        dispatchAsync: () => unimplemented(),
        close: () => unimplemented(),
      };

      await using host = new Vim(reader, writer);

      await t.step("before .init() calls", async (t) => {
        await t.step("when handle message", async (t) => {
          await t.step("'invoke' rejects", async () => {
            await assertRejects(
              () =>
                host.call(
                  "denops#_internal#test#request",
                  "invoke",
                  ["reload", ["dummy"]],
                ),
              Error,
              // TODO: Fix it by stringifying the error object.
              // "No service is registered in the host",
              "Failed to call",
            );
          });
        });
      });

      await t.step(".init()", async (t) => {
        await t.step("calls service.bind()", async () => {
          using service_bind = stub(service, "bind");

          await host.init(service);

          assertSpyCallArgs(service_bind, 0, [host]);
        });
      });

      await t.step(".redraw()", async (t) => {
        await t.step("sends a redraw command", async () => {
          using session_send = stub(
            Session.prototype,
            "send",
            resolvesNext([undefined]),
          );

          await host.redraw();

          assertSpyCallArgs(session_send, 0, [["redraw", ""]]);
        });

        await t.step("sends a redraw command with `force`", async () => {
          using session_send = stub(
            Session.prototype,
            "send",
            resolvesNext([undefined]),
          );

          await host.redraw(true);

          assertSpyCallArgs(session_send, 0, [["redraw", "force"]]);
        });
      });

      await t.step(".call()", async (t) => {
        await t.step("resolves a result of `fn`", async () => {
          const result = await host.call("abs", -4);

          assertEquals(result, 4);
        });

        await t.step("if `fn` does not exist", async (t) => {
          await t.step("rejects with an error", async () => {
            await assertRejects(
              () => host.call("@@@@@", -4),
              Error,
              "Failed to call '@@@@@' in Vim: Vim(let):E117: Unknown function: @@@@@",
            );
          });
        });

        await t.step("if Vim returns 'ERROR'", async (t) => {
          await t.step("rejects with an error", async () => {
            using _client_call = stub(
              Client.prototype,
              "call",
              resolvesNext(["ERROR"]),
            );

            await assertRejects(
              () => host.call("abs", -4),
              Error,
              'Vim just returns "ERROR"',
            );
          });
        });
      });

      await t.step(".batch()", async (t) => {
        await t.step("resolves results of `calls`", async () => {
          const [ret, err] = await host.batch(
            ["abs", -4],
            ["abs", 10],
            ["abs", -9],
          );

          assertEquals(ret, [4, 10, 9]);
          assertEquals(err, "");
        });

        await t.step("if some function does not exist", async (t) => {
          await t.step("resolves resutls and an error", async () => {
            const [ret, err] = await host.batch(
              ["abs", -4],
              ["abs", 10],
              ["@@@@@", -9],
              ["abs", 10],
            );

            assertEquals(ret, [4, 10]);
            assertMatch(
              err,
              /^Failed to call '@@@@@' in Vim: Vim\(.*\):E117: Unknown function: @@@@@/,
            );
          });

          await t.step("does not call functions after failure", async () => {
            await host.call("execute", [
              "let g:__test_host_batch_fn_calls = []",
              "function! TestHostBatchFn(...) abort",
              "  call add(g:__test_host_batch_fn_calls, a:000)",
              "endfunction",
            ], "");

            await host.batch(
              ["TestHostBatchFn", -4],
              ["TestHostBatchFn", 10],
              ["@@@@@", 10],
              ["TestHostBatchFn", -9],
              ["TestHostBatchFn", -4],
            );

            const actual = await host.call(
              "eval",
              "g:__test_host_batch_fn_calls",
            );
            assertEquals(actual, [[-4], [10]]);
          });
        });

        await t.step("if Vim returns 'ERROR'", async (t) => {
          await t.step("rejects with an error", async () => {
            using _client_call = stub(
              Client.prototype,
              "call",
              resolvesNext(["ERROR"]),
            );

            await assertRejects(
              () => host.batch(["abs", -4]),
              Error,
              'Vim just returns "ERROR"',
            );
          });
        });
      });

      await t.step(".notify()", async (t) => {
        await t.step("calls `fn`", async () => {
          await host.call("execute", [
            "let g:__test_host_notify_fn_calls = []",
            "function! TestHostNotifyFn(...) abort",
            "  call add(g:__test_host_notify_fn_calls, a:000)",
            "endfunction",
          ], "");

          await host.notify(
            "TestHostNotifyFn",
            "foo",
            4,
            undefined,
            null,
            false,
          );

          await delay(NOTIFY_DELAY); // maybe flaky
          const actual = await host.call(
            "eval",
            "g:__test_host_notify_fn_calls",
          );
          assertEquals(actual, [["foo", 4, null, null, false]]);
        });

        await t.step("if `fn` does not exist", async (t) => {
          await t.step("does not reject", async () => {
            await host.notify("@@@@@", -4);
          });
        });
      });

      await t.step("when handle request message", async (t) => {
        await t.step("'void'", async (t) => {
          await t.step("does nothing", async () => {
            await host.call(
              "denops#_internal#test#request",
              "void",
              [],
            );
          });
        });

        await t.step("'invoke'", async (t) => {
          await t.step("calls Service method", async () => {
            using service_reload = stub(service, "reload");

            await host.call(
              "denops#_internal#test#request",
              "invoke",
              ["reload", ["dummy"]],
            );

            assertSpyCallArgs(service_reload, 0, ["dummy"]);
          });

          await t.step("resolves a result of Service method", async () => {
            using _service_dispatch = stub(
              service,
              "dispatch",
              resolvesNext([{ foo: "dummy result" }]),
            );

            const actual = await host.call(
              "denops#_internal#test#request",
              "invoke",
              ["dispatch", ["dummy", "fn", ["arg0"]]],
            );

            assertEquals(actual, { foo: "dummy result" });
          });

          await t.step("if Service method rejects", async (t) => {
            await t.step("rejects with an error", async () => {
              using _service_dispatch = stub(
                service,
                "dispatch",
                () => Promise.reject("Error: stringified error message"),
              );

              await assertRejects(
                () =>
                  host.call(
                    "denops#_internal#test#request",
                    "invoke",
                    ["dispatch", ["dummy", "fn", ["arg0"]]],
                  ),
                Error,
                "Error: stringified error message",
              );
            });
          });
        });

        await t.step("unknown message", async (t) => {
          await t.step("rejects with an error", async () => {
            await assertRejects(
              () =>
                host.call(
                  "denops#_internal#test#request",
                  "unknown_message",
                  [0, "message"],
                ),
              Error,
              // TODO: Fix it by stringifying the error object.
              // 'Unexpected JSON channel message is received: ["unknown_message",0,"message"]',
              "Failed to call",
            );
          });
        });
      });

      await t.step("when handle notify message", async (t) => {
        await t.step("'void'", async (t) => {
          await t.step("does nothing", async () => {
            await host.call(
              "denops#_internal#test#notify",
              "void",
              [],
            );
          });
        });

        await t.step("'invoke'", async (t) => {
          await t.step("calls Service method", async () => {
            using service_reload = stub(service, "reload");

            await host.call(
              "denops#_internal#test#notify",
              "invoke",
              ["reload", ["dummy"]],
            );

            assertSpyCallArgs(service_reload, 0, ["dummy"]);
          });

          await t.step("if Service method rejects", async (t) => {
            await t.step("outputs an error message", async () => {
              using console_error = stub(console, "error");
              using _service_dispatch = stub(
                service,
                "dispatch",
                () => Promise.reject("Error: stringified error message"),
              );

              await host.call(
                "denops#_internal#test#notify",
                "invoke",
                ["dispatch", ["dummy", "fn", ["arg0"]]],
              );

              assertSpyCallArgs(
                console_error,
                0,
                ["Error: stringified error message"],
              );
            });
          });
        });

        await t.step("unknown message", async (t) => {
          await t.step("outputs an error message", async () => {
            using console_error = stub(console, "error");

            await host.call(
              "denops#_internal#test#notify",
              "unknown_message",
              [0, "message"],
            );

            assertSpyCalls(console_error, 1);
            assertEquals(
              console_error.calls[0].args.join(" "),
              'Error: Unexpected JSON channel message is received: ["unknown_message",0,"message"]',
            );
          });
        });
      });

      // NOTE: This test closes the session of the host.
      await t.step(".waitClosed()", async (t) => {
        const waitClosedPromise = host.waitClosed();

        await t.step("pendings before the session closes", async () => {
          assertEquals(await promiseState(waitClosedPromise), "pending");
        });

        // NOTE: Close the session of the host.
        await host[Symbol.asyncDispose]();

        await t.step("fulfilled when the session closes", async () => {
          assertEquals(await promiseState(waitClosedPromise), "fulfilled");
        });
      });
    },
  });
});
