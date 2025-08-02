import { assert, assertEquals } from "@std/assert";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const scriptInterrupt = resolveTestDataPath("dummy_interrupt_plugin.ts");

testHost({
  name: "denops#interrupt()",
  mode: "all",
  postlude: [
    "let g:__test_denops_events = []",
    "autocmd User DenopsPlugin* call add(g:__test_denops_events, expand('<amatch>'))",
    "autocmd User DummyInterruptPlugin:* call add(g:__test_denops_events, expand('<amatch>'))",
    "runtime plugin/denops.vim",
    // NOTE: Disable startup on VimEnter.
    "autocmd! denops_plugin_internal_startup VimEnter",
  ],
  fn: async ({ host, t }) => {
    await t.step("if the server is not yet running", async (t) => {
      await t.step("returns immediately", async () => {
        await host.call("denops#interrupt");
      });
    });

    // Start the server and wait.
    await host.call("denops#server#start");
    await wait(() => host.call("eval", "denops#server#status() ==# 'running'"));

    await t.step("if the plugin is not yet loaded", async (t) => {
      await t.step("returns immediately", async () => {
        await host.call("denops#interrupt");
      });
    });

    await t.step("if the plugin is loaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummy', '${scriptInterrupt}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummy")
      );

      await t.step("returns immediately", async () => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
        ], "");

        await host.call("denops#interrupt");

        // It should passed because of delay(MIMIC_ABORT_DELAY) in dummy_interrupt_plugin.ts
        assertEquals(await host.call("eval", "g:__test_denops_events"), []);
      });

      await t.step("sends signal to the plugin", async () => {
        await wait(() => host.call("eval", "len(g:__test_denops_events)"));
        const events = await host.call(
          "eval",
          "g:__test_denops_events",
        ) as string[];
        assert(
          events.some((event) =>
            event.startsWith("DummyInterruptPlugin:Interrupted:")
          ),
          `Expected event 'DummyInterruptPlugin:Interrupted:*', but: ${
            JSON.stringify(events)
          }`,
        );
      });

      // Reset interrupt event handler.
      await host.call("denops#request", "dummy", "reset", []);

      await t.step("sends signal to the plugin with reason", async () => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
        ], "");

        await host.call("denops#interrupt", "test");

        await wait(() => host.call("eval", "len(g:__test_denops_events)"));
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DummyInterruptPlugin:Interrupted:test",
        ]);
      });
    });
  },
});
