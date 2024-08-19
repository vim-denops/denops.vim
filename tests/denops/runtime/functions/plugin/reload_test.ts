import {
  assertEquals,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1";
import { join } from "jsr:@std/path@^1.0.2/join";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200; // msc

const scriptValid = resolve("dummy_valid_plugin.ts");
const scriptInvalidDispose = resolve("dummy_invalid_dispose_plugin.ts");

testHost({
  name: "denops#plugin#reload()",
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
          () => host.call("denops#plugin#reload", "dummy.invalid"),
          Error,
          "Invalid plugin name: dummy.invalid",
        );
      });
    });

    await t.step("if the plugin is not yet loaded", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#reload('notexistsplugin')",
      ], "");

      await t.step("does not reload a denops plugin", async () => {
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
        `call denops#plugin#load('dummyReloadInvalid', '${scriptInvalidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyReloadInvalid")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#reload('dummyReloadInvalid')",
      ], "");

      await t.step("reloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadInvalid")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyReloadInvalid",
          "DenopsPluginUnloadFail:dummyReloadInvalid",
          "DenopsPluginPre:dummyReloadInvalid",
          "DenopsPluginPost:dummyReloadInvalid",
        ]);
      });

      await t.step("outputs an error message after delayed", async () => {
        await delay(MESSAGE_DELAY);
        assertMatch(
          outputs.join(""),
          /Failed to unload plugin 'dummyReloadInvalid': Error: This is dummy error in async dispose/,
        );
      });
    });

    await t.step("if the plugin is loading", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyReloadLoading', '${scriptValid}')`,
        "call denops#plugin#reload('dummyReloadLoading')",
      ], "");

      await t.step("reloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => ev.startsWith("DenopsPluginPost:"))
            .length >= 2
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginPre:dummyReloadLoading",
          "DenopsPluginPost:dummyReloadLoading",
          "DenopsPluginUnloadPre:dummyReloadLoading",
          "DenopsPluginUnloadPost:dummyReloadLoading",
          "DenopsPluginPre:dummyReloadLoading",
          "DenopsPluginPost:dummyReloadLoading",
        ]);
      });

      await t.step("calls the plugin entrypoint twice", () => {
        assertMatch(outputs.join(""), /Hello, Denops!.*Hello, Denops!/s);
      });
    });

    await t.step("if the plugin is loaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyReloadLoaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyReloadLoaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#reload('dummyReloadLoaded')",
      ], "");

      await t.step("reloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadLoaded")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyReloadLoaded",
          "DenopsPluginUnloadPost:dummyReloadLoaded",
          "DenopsPluginPre:dummyReloadLoaded",
          "DenopsPluginPost:dummyReloadLoaded",
        ]);
      });

      await t.step("calls the plugin entrypoint", () => {
        assertMatch(outputs.join(""), /Hello, Denops!/);
      });
    });

    await t.step("if the plugin is unloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyReloadUnloading', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyReloadUnloading")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#unload('dummyReloadUnloading')`,
        "call denops#plugin#reload('dummyReloadUnload')",
      ], "");

      await t.step("does not reload a denops plugin", async () => {
        const actual = wait(
          async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyReloadUnloading"),
          { timeout: 1000, interval: 100 },
        );
        await assertRejects(() => actual, Error, "Timeout");
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyReloadUnloading",
          "DenopsPluginUnloadPost:dummyReloadUnloading",
        ]);
      });

      await t.step("does not output messages", async () => {
        await delay(MESSAGE_DELAY);
        assertEquals(outputs, []);
      });
    });

    await t.step("if the plugin is unloaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyReloadUnloaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyReloadUnloaded")
      );
      // Unload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#unload('dummyReloadUnloaded')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginUnloadPost:dummyReloadUnloaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#reload('dummyReloadUnload')",
      ], "");

      await t.step("does not reload a denops plugin", async () => {
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
        `call denops#plugin#load('dummyReloadReloading', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyReloadReloading")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyReloadReloading')`,
        "call denops#plugin#reload('dummyReloadReloading')",
      ], "");

      await t.step("reloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadReloading")
        );
      });

      await t.step("does not reload a denops plugin twice", async () => {
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
          "DenopsPluginUnloadPre:dummyReloadReloading",
          "DenopsPluginUnloadPost:dummyReloadReloading",
          "DenopsPluginPre:dummyReloadReloading",
          "DenopsPluginPost:dummyReloadReloading",
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
        `call denops#plugin#load('dummyReloadReloaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyReloadReloaded")
      );
      // Reload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyReloadReloaded')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyReloadReloaded")
      );

      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "call denops#plugin#reload('dummyReloadReloaded')",
      ], "");

      await t.step("reloads a denops plugin", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadReloaded")
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertEquals(await host.call("eval", "g:__test_denops_events"), [
          "DenopsPluginUnloadPre:dummyReloadReloaded",
          "DenopsPluginUnloadPost:dummyReloadReloaded",
          "DenopsPluginPre:dummyReloadReloaded",
          "DenopsPluginPost:dummyReloadReloaded",
        ]);
      });

      await t.step("calls the plugin entrypoint", () => {
        assertMatch(outputs.join(""), /Hello, Denops!/);
      });
    });
  },
});

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../../../testdata/${path}`);
}
