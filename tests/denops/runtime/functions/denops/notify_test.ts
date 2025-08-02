import { assertEquals, assertStringIncludes } from "@std/assert";
import { delay } from "@std/async/delay";
import { INVALID_PLUGIN_NAMES } from "/denops-testdata/invalid_plugin_names.ts";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200;

const scriptDispatcher = resolveTestDataPath("dummy_dispatcher_plugin.ts");

testHost({
  name: "denops#notify()",
  mode: "all",
  postlude: [
    "runtime plugin/denops.vim",
  ],
  fn: async ({ host, t, stderr }) => {
    let outputs: string[] = [];
    stderr.pipeTo(
      new WritableStream({ write: (s) => void outputs.push(s) }),
    ).catch(() => {});
    await wait(() => host.call("eval", "denops#server#status() ==# 'running'"));
    await host.call("execute", [
      "let g:__test_denops_events = []",
      "autocmd User DenopsPlugin* call add(g:__test_denops_events, expand('<amatch>'))",
      "autocmd User DummyDispatcherPlugin:* call add(g:__test_denops_events, expand('<amatch>'))",
    ], "");

    for (const [plugin_name, label] of INVALID_PLUGIN_NAMES) {
      await t.step(`if the plugin name is invalid (${label})`, async (t) => {
        await t.step("does not throw an error", async () => {
          await host.call("denops#notify", plugin_name, "test", ["foo"]);
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

        await host.call("denops#notify", "dummy", "test", ["foo"]);

        assertEquals(await host.call("eval", "g:__test_denops_events"), []);
      });

      await t.step("calls dispatcher method", async () => {
        await wait(() => host.call("eval", "len(g:__test_denops_events)"));
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          'DummyDispatcherPlugin:TestCalled:["foo"]',
        ]);
      });

      await t.step("if the dispatcher method is not exist", async (t) => {
        await t.step("returns immediately (flaky)", async () => {
          outputs = [];

          await host.call(
            "denops#notify",
            "dummy",
            "not_exist_method",
            ["foo"],
          );

          assertEquals(outputs, []);
        });

        await t.step("outputs an error message", async () => {
          await delay(MESSAGE_DELAY);
          assertStringIncludes(
            outputs.join(""),
            "Failed to call 'not_exist_method' API in 'dummy'",
          );
        });
      });
    });
  },
});
