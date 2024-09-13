import {
  assertEquals,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200; // msc

const scriptValidDispose = resolveTestDataPath("dummy_valid_dispose_plugin.ts");
const scriptInvalidDispose = resolveTestDataPath(
  "dummy_invalid_dispose_plugin.ts",
);

testHost({
  name: "denops#plugin#unload()",
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
          () => host.call("denops#plugin#unload", "dummy.invalid"),
          Error,
          "Invalid plugin name: dummy.invalid",
        );
      });
    });

    await t.step("if the plugin is not yet loaded", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#unload('notexistsplugin')",
      ], "");

      await t.step("does not unload a denops plugin", async () => {
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

    await t.step("if the plugin dispose method throws", async (t) => {
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyUnloadInvalid', '${scriptInvalidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyUnloadInvalid")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#unload('dummyUnloadInvalid')",
      ], "");

      await t.step("unloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadFail:dummyUnloadInvalid")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyUnloadInvalid",
          "DenopsPluginUnloadFail:dummyUnloadInvalid",
        ]);
      });

      await t.step("outputs an error message after delayed", async () => {
        await delay(MESSAGE_DELAY);
        assertMatch(
          outputs.join(""),
          /Failed to unload plugin 'dummyUnloadInvalid': Error: This is dummy error in async dispose/,
        );
      });
    });

    await t.step("if the plugin is loading", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyUnloadLoading', '${scriptValidDispose}')`,
        "call denops#plugin#unload('dummyUnloadLoading')",
      ], "");

      await t.step("unloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyUnloadLoading")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginPre:dummyUnloadLoading",
          "DenopsPluginPost:dummyUnloadLoading",
          "DenopsPluginUnloadPre:dummyUnloadLoading",
          "DenopsPluginUnloadPost:dummyUnloadLoading",
        ]);
      });

      await t.step("calls the plugin dispose method", () => {
        assertMatch(outputs.join(""), /Goodbye, Denops!/);
      });
    });

    await t.step("if the plugin is loaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyUnloadLoaded', '${scriptValidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyUnloadLoaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#unload('dummyUnloadLoaded')",
      ], "");

      await t.step("unloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyUnloadLoaded")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyUnloadLoaded",
          "DenopsPluginUnloadPost:dummyUnloadLoaded",
        ]);
      });

      await t.step("calls the plugin dispose method", () => {
        assertMatch(outputs.join(""), /Goodbye, Denops!/);
      });
    });

    await t.step("if the plugin is unloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyUnloadUnloading', '${scriptValidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyUnloadUnloading")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#unload('dummyUnloadUnloading')`,
        "call denops#plugin#unload('dummyUnloadUnloading')",
      ], "");

      await t.step("unloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyUnloadUnloading")
        );
      });

      await t.step("does not unload a denops plugin twice", async () => {
        const actual = wait(
          async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("DenopsPluginUnloadPost:"))
              .length >= 2,
          { timeout: 1000, interval: 100 },
        );
        await assertRejects(() => actual, Error, "Timeout");
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyUnloadUnloading",
          "DenopsPluginUnloadPost:dummyUnloadUnloading",
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
        `call denops#plugin#load('dummyUnloadUnloaded', '${scriptValidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyUnloadUnloaded")
      );
      // Unload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#unload('dummyUnloadUnloaded')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginUnloadPost:dummyUnloadUnloaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#unload('dummyUnloadUnloaded')",
      ], "");

      await t.step("does not unload a denops plugin", async () => {
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

    await t.step("if the plugin is reloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyUnloadReloading', '${scriptValidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyUnloadReloading")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyUnloadReloading')`,
        "call denops#plugin#unload('dummyUnloadReloading')",
      ], "");

      await t.step("reloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnloadReloading")
        );
      });

      await t.step("does not unload a denops plugin twice", async () => {
        const actual = wait(
          async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("DenopsPluginUnloadPost:"))
              .length >= 2,
          { timeout: 1000, interval: 100 },
        );
        await assertRejects(() => actual, Error, "Timeout");
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyUnloadReloading",
          "DenopsPluginUnloadPost:dummyUnloadReloading",
          "DenopsPluginPre:dummyUnloadReloading",
          "DenopsPluginPost:dummyUnloadReloading",
        ]);
      });

      await t.step("calls the plugin dispose method", () => {
        assertMatch(outputs.join(""), /Goodbye, Denops!/);
      });
    });

    await t.step("if the plugin is reloaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyUnloadReloaded', '${scriptValidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyUnloadReloaded")
      );
      // Reload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyUnloadReloaded')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyUnloadReloaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#unload('dummyUnloadReloaded')",
      ], "");

      await t.step("unloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyUnloadReloaded")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyUnloadReloaded",
          "DenopsPluginUnloadPost:dummyUnloadReloaded",
        ]);
      });

      await t.step("calls the plugin dispose method", () => {
        assertMatch(outputs.join(""), /Goodbye, Denops!/);
      });
    });
  },
});
