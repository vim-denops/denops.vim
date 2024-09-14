import {
  assertEquals,
  assertObjectMatch,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.1";
import { INVALID_PLUGIN_NAMES } from "/denops-testdata/invalid_plugin_names.ts";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const scriptValid = resolveTestDataPath("dummy_valid_plugin.ts");

testHost({
  name: "denops#request_async()",
  mode: "all",
  postlude: [
    "runtime plugin/denops.vim",
  ],
  fn: async ({ host, t, stderr, mode }) => {
    let outputs: string[] = [];
    stderr.pipeTo(
      new WritableStream({ write: (s) => void outputs.push(s) }),
    ).catch(() => {});
    await wait(() => host.call("eval", "denops#server#status() ==# 'running'"));
    await host.call("execute", [
      "let g:__test_denops_events = []",
      "autocmd User DenopsPlugin* call add(g:__test_denops_events, expand('<amatch>'))",
      "function TestDenopsRequestAsyncSuccess(...)",
      "  call add(g:__test_denops_events, ['TestDenopsRequestAsyncSuccess', a:000])",
      "endfunction",
      "function TestDenopsRequestAsyncFailure(...)",
      "  call add(g:__test_denops_events, ['TestDenopsRequestAsyncFailure', a:000])",
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
            await host.call("eval", "g:__test_denops_events") as [],
            {
              0: [
                "TestDenopsRequestAsyncFailure",
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
        `call denops#plugin#load('dummyLoaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoaded")
      );
      await host.call("execute", [
        "let g:__test_denops_events = []",
      ], "");

      outputs = [];
      await host.call(
        "denops#request_async",
        "dummyLoaded",
        "test",
        ["foo"],
        "TestDenopsRequestAsyncSuccess",
        "TestDenopsRequestAsyncFailure",
      );

      await t.step("returns immediately", () => {
        assertEquals(outputs, []);
      });

      await t.step("calls success callback", async () => {
        await wait(() => host.call("eval", "len(g:__test_denops_events)"));
        const returnValue = mode === "vim" ? null : 0;
        assertObjectMatch(
          await host.call("eval", "g:__test_denops_events") as [],
          {
            0: ["TestDenopsRequestAsyncSuccess", [returnValue]],
          },
        );
      });

      await t.step("calls dispatcher method", () => {
        assertStringIncludes(outputs.join(""), 'This is test call: ["foo"]');
      });
    });
  },
});
