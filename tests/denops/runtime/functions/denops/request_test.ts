import { assertRejects, assertStringIncludes } from "jsr:@std/assert@^1.0.1";
import { INVALID_PLUGIN_NAMES } from "/denops-testdata/invalid_plugin_names.ts";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const scriptValid = resolveTestDataPath("dummy_valid_plugin.ts");

testHost({
  name: "denops#request()",
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
        `call denops#plugin#load('dummyLoaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoaded")
      );

      await t.step("calls dispatcher method", async () => {
        outputs = [];
        await host.call("denops#request", "dummyLoaded", "test", ["foo"]);

        assertStringIncludes(outputs.join(""), 'This is test call: ["foo"]');
      });
    });
  },
});
