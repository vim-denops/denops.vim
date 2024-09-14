import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1/delay";
import { INVALID_PLUGIN_NAMES } from "/denops-testdata/invalid_plugin_names.ts";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const ASYNC_DELAY = 100;

const scriptValid = resolveTestDataPath("dummy_valid_plugin.ts");

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
        `call denops#plugin#load('dummyLoaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoaded")
      );

      outputs = [];
      await host.call("denops#notify", "dummyLoaded", "test", ["foo"]);

      await t.step("returns immediately", () => {
        assertEquals(outputs, []);
      });

      await t.step("calls dispatcher method", async () => {
        await delay(ASYNC_DELAY);
        assertStringIncludes(outputs.join(""), 'This is test call: ["foo"]');
      });
    });
  },
});
