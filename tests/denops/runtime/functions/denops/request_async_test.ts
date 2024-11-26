import {
  assertArrayIncludes,
  assertEquals,
  assertObjectMatch,
} from "jsr:@std/assert@^1.0.1";
import { INVALID_PLUGIN_NAMES } from "/denops-testdata/invalid_plugin_names.ts";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const scriptDispatcher = resolveTestDataPath("dummy_dispatcher_plugin.ts");

testHost({
  name: "denops#request_async()",
  mode: "all",
  postlude: [
    "runtime plugin/denops.vim",
  ],
  fn: async ({ host, t }) => {
    await wait(() => host.call("eval", "denops#server#status() ==# 'running'"));
    await host.call("execute", [
      "let g:__test_denops_events = []",
      "autocmd User DenopsPlugin* call add(g:__test_denops_events, expand('<amatch>'))",
      "autocmd User DummyDispatcherPlugin:* call add(g:__test_denops_events, expand('<amatch>'))",
      "function TestDenopsRequestAsyncSuccess(...)",
      "  call add(g:__test_denops_events, ['TestDenopsRequestAsyncSuccess:Called', a:000])",
      "endfunction",
      "function TestDenopsRequestAsyncFailure(...)",
      "  call add(g:__test_denops_events, ['TestDenopsRequestAsyncFailure:Called', a:000])",
      "endfunction",
    ], "");

    for (const [plugin_name, label] of INVALID_PLUGIN_NAMES) {
      await t.step(`if the plugin name is invalid (${label})`, async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
        ], "");

        await t.step("does not throw an error", async () => {
          await host.call(
            "denops#request_async",
            plugin_name,
            "test",
            ["foo"],
            "TestDenopsRequestAsyncSuccess",
            "TestDenopsRequestAsyncFailure",
          );
        });

        await t.step("calls failure callback", async () => {
          await wait(() => host.call("eval", "len(g:__test_denops_events)"));
          assertObjectMatch(
            await host.call("eval", "g:__test_denops_events") as unknown[],
            {
              0: [
                "TestDenopsRequestAsyncFailure:Called",
                [
                  {
                    message: `Invalid plugin name: ${plugin_name}`,
                    name: "TypeError",
                  },
                ],
              ],
            },
          );
        });
      });
    }

    await t.step("if the plugin is loaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummy', '${scriptDispatcher}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummy")
      );

      await t.step("returns immediately", async () => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
        ], "");

        await host.call(
          "denops#request_async",
          "dummy",
          "test",
          ["foo"],
          "TestDenopsRequestAsyncSuccess",
          "TestDenopsRequestAsyncFailure",
        );

        assertEquals(await host.call("eval", "g:__test_denops_events"), []);
      });

      await t.step("calls dispatcher method", async () => {
        await wait(() => host.call("eval", "len(g:__test_denops_events)"));
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as unknown[],
          ['DummyDispatcherPlugin:TestCalled:["foo"]'],
        );
      });

      await t.step("calls success callback", async () => {
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as unknown[],
          [
            [
              "TestDenopsRequestAsyncSuccess:Called",
              [{ result: "OK", args: ["foo"] }],
            ],
          ],
        );
      });

      await t.step("if the dispatcher method throws an error", async (t) => {
        await t.step("returns immediately", async () => {
          await host.call("execute", [
            "let g:__test_denops_events = []",
            "call denops#request_async('dummy', 'fail', ['foo'], 'TestDenopsRequestAsyncSuccess', 'TestDenopsRequestAsyncFailure')",
            "let g:__test_denops_events_after_called = g:__test_denops_events->copy()",
          ], "");

          assertEquals(
            await host.call("eval", "g:__test_denops_events_after_called"),
            [],
          );
        });

        await t.step("calls failure callback", async () => {
          await wait(() => host.call("eval", "len(g:__test_denops_events)"));
          assertObjectMatch(
            await host.call("eval", "g:__test_denops_events") as unknown[],
            {
              0: [
                "TestDenopsRequestAsyncFailure:Called",
                [
                  {
                    message:
                      "Failed to call 'fail' API in 'dummy': Dummy failure",
                    name: "Error",
                  },
                ],
              ],
            },
          );
        });
      });

      await t.step("if the dispatcher method is not exist", async (t) => {
        await t.step("returns immediately", async () => {
          await host.call("execute", [
            "let g:__test_denops_events = []",
            "call denops#request_async('dummy', 'not_exist_method', ['foo'], 'TestDenopsRequestAsyncSuccess', 'TestDenopsRequestAsyncFailure')",
            "let g:__test_denops_events_after_called = g:__test_denops_events->copy()",
          ], "");

          assertEquals(
            await host.call("eval", "g:__test_denops_events_after_called"),
            [],
          );
        });

        await t.step("calls failure callback", async () => {
          await wait(() => host.call("eval", "len(g:__test_denops_events)"));
          assertObjectMatch(
            await host.call("eval", "g:__test_denops_events") as unknown[],
            {
              0: [
                "TestDenopsRequestAsyncFailure:Called",
                [
                  {
                    message:
                      "Failed to call 'not_exist_method' API in 'dummy': this[#denops].dispatcher[fn] is not a function",
                    name: "Error",
                  },
                ],
              ],
            },
          );
        });
      });
    });
  },
});
