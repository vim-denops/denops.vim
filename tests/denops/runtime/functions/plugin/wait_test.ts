import {
  assertArrayIncludes,
  assertEquals,
  assertGreater,
  assertLess,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^0.224.0";
import { join } from "jsr:@std/path@^1.0.2/join";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200; // msc

const scriptValid = resolve("dummy_valid_plugin.ts");
const scriptInvalid = resolve("dummy_invalid_plugin.ts");
const scriptValidWait = resolve("dummy_valid_wait_plugin.ts");
const scriptInvalidWait = resolve("dummy_invalid_wait_plugin.ts");

testHost({
  name: "denops#plugin#wait()",
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

    await t.step("if the plugin name is invalid", async (t) => {
      await t.step("throws an error", async () => {
        // NOTE: '.' is not allowed in plugin name.
        await assertRejects(
          () => host.call("denops#plugin#wait", "dummy.invalid"),
          Error,
          "Invalid plugin name: dummy.invalid",
        );
      });
    });

    await t.step("if the plugin is loading", async (t) => {
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitLoading', '${scriptValidWait}')`,
        "let g:__test_denops_wait_start = reltime()",
        "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitLoading', {'timeout': 5000})",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("waits the plugin is loaded", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertGreater(elapsed_sec, 1.0);
        assertLess(elapsed_sec, 5.0);
      });

      await t.step("returns 0", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_wait_result",
        );
        assertEquals(actual, 0);
      });

      await t.step("the plugin is loaded after returns", async () => {
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          ["DenopsPluginPost:dummyWaitLoading"],
        );
      });
    });

    await t.step("if the plugin is loaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitLoaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyWaitLoaded")
      );

      await host.call("execute", [
        "let g:__test_denops_wait_start = reltime()",
        "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitLoaded', {'timeout': 5000})",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("returns 0", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_wait_result",
        );
        assertEquals(actual, 0);
      });
    });

    await t.step("if the plugin is reloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitReloading', '${scriptValidWait}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyWaitReloading")
      );

      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyWaitReloading')`,
        "let g:__test_denops_wait_start = reltime()",
        "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitReloading', {'timeout': 5000})",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("waits the plugin is loaded", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertGreater(elapsed_sec, 1.0);
        assertLess(elapsed_sec, 5.0);
      });

      await t.step("returns 0", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_wait_result",
        );
        assertEquals(actual, 0);
      });

      await t.step("the plugin is loaded after returns", async () => {
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          ["DenopsPluginPost:dummyWaitReloading"],
        );
      });
    });

    await t.step("if the plugin is reloaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitReloaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyWaitReloaded")
      );
      // Reload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyWaitReloaded')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyWaitReloaded")
      );

      await host.call("execute", [
        "let g:__test_denops_wait_start = reltime()",
        "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitReloaded', {'timeout': 5000})",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("returns 0", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_wait_result",
        );
        assertEquals(actual, 0);
      });
    });

    await t.step("if the plugin is loading and fails", async (t) => {
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitLoadingAndFails', '${scriptInvalidWait}')`,
        "let g:__test_denops_wait_start = reltime()",
        "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitLoadingAndFails', {'timeout': 5000})",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("waits the plugin is failed", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertGreater(elapsed_sec, 1.0);
        assertLess(elapsed_sec, 5.0);
      });

      await t.step("returns -3", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_wait_result",
        );
        assertEquals(actual, -3);
      });

      await t.step("the plugin is failed after returns", async () => {
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          ["DenopsPluginFail:dummyWaitLoadingAndFails"],
        );
      });
    });

    await t.step("if the plugin is failed to load", async (t) => {
      // Load plugin and wait failure.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitFailed', '${scriptInvalid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginFail:dummyWaitFailed")
      );

      await host.call("execute", [
        "let g:__test_denops_wait_start = reltime()",
        "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitFailed', {'timeout': 5000})",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("returns -3", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_wait_result",
        );
        assertEquals(actual, -3);
      });

      await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#load()
    });

    await t.step("if it times out", async (t) => {
      await t.step("if no `silent` is specified", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('notexistsplugin', {'timeout': 1000})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("waits `timeout` expired", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertGreater(elapsed_sec, 1.0);
          assertLess(elapsed_sec, 5.0);
        });

        await t.step("returns -1", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, -1);
        });

        await t.step("outputs an error message", async () => {
          await delay(MESSAGE_DELAY);
          assertStringIncludes(
            outputs.join(""),
            'Failed to wait for "notexistsplugin" to start. It took more than 1000 milliseconds and timed out.',
          );
        });
      });

      await t.step("if `silent=1`", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('notexistsplugin', {'timeout': 1000, 'silent': 1})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("waits `timeout` expired", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertGreater(elapsed_sec, 1.0);
          assertLess(elapsed_sec, 5.0);
        });

        await t.step("returns -1", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, -1);
        });

        await t.step("does not output error messages", async () => {
          await delay(MESSAGE_DELAY);
          assertEquals(outputs, []);
        });
      });
    });

    await t.step("if `denops#_internal#wait#timeout` expires", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:denops#_internal#wait#timeout = 500",
        "call denops#plugin#wait('notexistsplugin', {'timeout': 1000})",
      ], "");

      await t.step("outputs an warning message", async () => {
        await delay(MESSAGE_DELAY);
        assertStringIncludes(
          outputs.join(""),
          "It tooks more than 500 ms. Use Ctrl-C to cancel.",
        );
      });
    });

    // NOTE: This test stops the denops server.
    await t.step("if the denops server is stopped", async (t) => {
      await host.call("denops#server#stop");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'stopped'"),
      );

      await t.step("if no `silent` is specified", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('dummy', {'timeout': 1000})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("returns -2", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, -2);
        });

        await t.step("outputs an error message", async () => {
          await delay(MESSAGE_DELAY);
          assertStringIncludes(
            outputs.join(""),
            'Failed to wait for "dummy" to start. Denops server itself is not started.',
          );
        });
      });

      await t.step("if `silent=1`", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('dummy', {'timeout': 1000, 'silent': 1})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("returns -2", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, -2);
        });

        await t.step("does not output error messages", async () => {
          await delay(MESSAGE_DELAY);
          assertEquals(outputs, []);
        });
      });
    });
  },
});

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../../../testdata/${path}`);
}
