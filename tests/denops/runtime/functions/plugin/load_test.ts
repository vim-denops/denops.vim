import {
  assertEquals,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^0.224.0";
import { join } from "jsr:@std/path@^1.0.2/join";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200; // msc

const scriptValid = resolve("dummy_valid_plugin.ts");
const scriptInvalid = resolve("dummy_invalid_plugin.ts");
const scriptValidDispose = resolve("dummy_valid_dispose_plugin.ts");

testHost({
  name: "denops#plugin#load()",
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
          () => host.call("denops#plugin#load", "dummy.invalid", scriptValid),
          Error,
          "Invalid plugin name: dummy.invalid",
        );
      });
    });

    await t.step("if the plugin is not yet loaded", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadNotLoaded', '${scriptValid}')`,
      ], "");

      await t.step("loads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadNotLoaded")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginPre:dummyLoadNotLoaded",
          "DenopsPluginPost:dummyLoadNotLoaded",
        ]);
      });

      await t.step("calls the plugin entrypoint", () => {
        assertMatch(outputs.join(""), /Hello, Denops!/);
      });
    });

    await t.step("if the plugin entrypoint throws", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadInvalid', '${scriptInvalid}')`,
      ], "");

      await t.step("fails loading a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginFail:dummyLoadInvalid")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginPre:dummyLoadInvalid",
          "DenopsPluginFail:dummyLoadInvalid",
        ]);
      });

      await t.step("outputs an error message after delayed", async () => {
        await delay(MESSAGE_DELAY);
        assertMatch(
          outputs.join(""),
          /Failed to load plugin 'dummyLoadInvalid': Error: This is dummy error/,
        );
      });
    });

    await t.step(
      "if the plugin is the same script with a different name",
      async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadOther', '${scriptValid}')`,
        ], "");

        await t.step("loads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyLoadOther")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummyLoadOther",
            "DenopsPluginPost:dummyLoadOther",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      },
    );

    await t.step("if the plugin is loading", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadLoading', '${scriptValid}')`,
        `call denops#plugin#load('dummyLoadLoading', '${scriptValid}')`,
      ], "");

      await t.step("loads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadLoading")
        );
      });

      await t.step("does not load a denops plugin twice", async () => {
        const actual = wait(
          async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("DenopsPluginPost:"))
              .length >= 2,
          { timeout: 1000, interval: 100 },
        );
        await assertRejects(() => actual, Error, "Timeout");
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginPre:dummyLoadLoading",
          "DenopsPluginPost:dummyLoadLoading",
        ]);
      });

      await t.step("calls the plugin entrypoint", () => {
        assertMatch(outputs.join(""), /Hello, Denops!/);
      });
    });

    await t.step("if the plugin is loaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadLoaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoadLoaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadLoaded', '${scriptValid}')`,
      ], "");

      await t.step("does not load a denops plugin", async () => {
        const actual = wait(
          () => host.call("eval", "len(g:__test_denops_events)"),
          { timeout: 1000, interval: 100 },
        );
        await assertRejects(() => actual, Error, "Timeout");
      });

      await t.step("does not fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), []);
      });

      await t.step("does not output messages", async () => {
        await delay(MESSAGE_DELAY);
        assertEquals(outputs, []);
      });
    });

    await t.step("if the plugin is unloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadUnloading', '${scriptValidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoadUnloading")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#unload('dummyLoadUnloading')`,
        `call denops#plugin#load('dummyLoadUnloading', '${scriptValid}')`,
      ], "");

      await t.step("unloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyLoadUnloading")
        );
      });

      await t.step("does not load a denops plugin", async () => {
        const actual = wait(
          async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyLoadUnloading"),
          { timeout: 1000, interval: 100 },
        );
        await assertRejects(() => actual, Error, "Timeout");
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyLoadUnloading",
          "DenopsPluginUnloadPost:dummyLoadUnloading",
        ]);
      });

      await t.step("calls the plugin dispose method", () => {
        assertMatch(outputs.join(""), /Goodbye, Denops!/);
      });
    });

    await t.step("if the plugin is unloaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadUnloaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoadUnloaded")
      );
      // Unload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#unload('dummyLoadUnloaded')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginUnloadPost:dummyLoadUnloaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadUnloaded', '${scriptValid}')`,
      ], "");

      await t.step("loads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadUnloaded")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginPre:dummyLoadUnloaded",
          "DenopsPluginPost:dummyLoadUnloaded",
        ]);
      });

      await t.step("calls the plugin entrypoint", () => {
        assertMatch(outputs.join(""), /Hello, Denops!/);
      });
    });

    await t.step("if the plugin is reloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadReloading', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoadReloading")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyLoadReloading')`,
        `call denops#plugin#load('dummyLoadReloading', '${scriptValid}')`,
      ], "");

      await t.step("reloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadReloading")
        );
      });

      await t.step("does not load a denops plugin twice", async () => {
        const actual = wait(
          async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("DenopsPluginPost:"))
              .length >= 2,
          { timeout: 1000, interval: 100 },
        );
        await assertRejects(() => actual, Error, "Timeout");
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyLoadReloading",
          "DenopsPluginUnloadPost:dummyLoadReloading",
          "DenopsPluginPre:dummyLoadReloading",
          "DenopsPluginPost:dummyLoadReloading",
        ]);
      });

      await t.step("calls the plugin entrypoint", () => {
        assertMatch(outputs.join(""), /Hello, Denops!/);
      });
    });

    await t.step("if the plugin is reloaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadReloaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoadReloaded")
      );
      // Reload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyLoadReloaded')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyLoadReloaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyLoadReloaded', '${scriptValid}')`,
      ], "");

      await t.step("does not load a denops plugin", async () => {
        const actual = wait(
          () => host.call("eval", "len(g:__test_denops_events)"),
          { timeout: 1000, interval: 100 },
        );
        await assertRejects(() => actual, Error, "Timeout");
      });

      await t.step("does not fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), []);
      });

      await t.step("does not output messages", async () => {
        await delay(MESSAGE_DELAY);
        assertEquals(outputs, []);
      });
    });
  },
});

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../../../testdata/${path}`);
}
