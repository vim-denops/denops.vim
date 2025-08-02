import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { INVALID_PLUGIN_NAMES } from "/denops-testdata/invalid_plugin_names.ts";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const scriptDispatcher = resolveTestDataPath("dummy_dispatcher_plugin.ts");

testHost({
  name: "denops#request()",
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
    ], "");

    for (const [plugin_name, label] of INVALID_PLUGIN_NAMES) {
      await t.step(`if the plugin name is invalid (${label})`, async (t) => {
        await t.step("throws an error", async () => {
          await assertRejects(
            () => host.call("denops#request", plugin_name, "test", ["foo"]),
            Error,
            `Invalid plugin name: ${plugin_name}`,
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

      await t.step("calls dispatcher method", async () => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
        ], "");

        await host.call("denops#request", "dummy", "test", ["foo"]);

        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          'DummyDispatcherPlugin:TestCalled:["foo"]',
        ]);
      });

      await t.step("returns dispatcher method return value", async () => {
        const result = await host.call(
          "denops#request",
          "dummy",
          "test",
          ["foo"],
        );

        assertEquals(result, { result: "OK", args: ["foo"] });
      });

      await t.step("if the dispatcher method throws an error", async (t) => {
        await t.step("throws an error", async () => {
          const result = await host.call(
            "denops#request",
            "dummy",
            "fail",
            ["foo"],
          ).catch((e) => e);
          assertInstanceOf(result, Error);
          assertStringIncludes(
            result.message,
            "Failed to call 'fail' API in 'dummy': Error: Dummy failure",
          );
          assertStringIncludes(
            result.message,
            "dummy_dispatcher_plugin.ts:19:13",
            "Error message should include the where the original error occurred",
          );
        });
      });

      await t.step("if the dispatcher method is not exist", async (t) => {
        await t.step("throws an error", async () => {
          await assertRejects(
            () =>
              host.call(
                "denops#request",
                "dummy",
                "not_exist_method",
                ["foo"],
              ),
            Error,
            "Failed to call 'not_exist_method' API in 'dummy': TypeError: this[#denops].dispatcher[fn] is not a function",
          );
        });
      });
    });
  },
});
