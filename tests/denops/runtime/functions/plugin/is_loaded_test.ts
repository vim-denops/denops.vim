import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200; // msc

const scriptValid = resolveTestDataPath("dummy_valid_plugin.ts");
const scriptInvalid = resolveTestDataPath("dummy_invalid_plugin.ts");
const scriptInvalidDispose = resolveTestDataPath(
  "dummy_invalid_dispose_plugin.ts",
);

testHost({
  name: "denops#plugin#is_loaded()",
  mode: "all",
  postlude: [
    "runtime plugin/denops.vim",
  ],
  fn: async ({ host, t }) => {
    await wait(() => host.call("eval", "denops#server#status() ==# 'running'"));
    await host.call("execute", [
      "let g:__test_denops_events = []",
      "autocmd User DenopsPlugin* call add(g:__test_denops_events, expand('<amatch>'))",
      "let g:__test_denops_is_loaded = {}",
      "augroup __test_denops_is_loaded",
      "  autocmd!",
      "  autocmd User DenopsPlugin* let g:__test_denops_is_loaded[expand('<amatch>')] = denops#plugin#is_loaded(expand('<amatch>')->matchstr(':\\zs.*'))",
      "augroup END",
    ], "");

    await t.step("if the plugin name is invalid", async (t) => {
      await t.step("throws an error", async () => {
        // NOTE: '.' is not allowed in plugin name.
        await assertRejects(
          () => host.call("denops#plugin#is_loaded", "dummy.invalid"),
          Error,
          "Invalid plugin name: dummy.invalid",
        );
      });
    });

    await t.step("if the plugin is not yet loaded", async (t) => {
      await t.step("returns 0", async () => {
        const actual = await host.call(
          "denops#plugin#is_loaded",
          "notexistsplugin",
        );
        assertEquals(actual, 0);
      });
    });

    await t.step("if the plugin entrypoint throws", async (t) => {
      // Load plugin and wait failure.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "let g:__test_denops_is_loaded = {}",
        `call denops#plugin#load('dummyIsLoadedInvalid', '${scriptInvalid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginFail:dummyIsLoadedInvalid")
      );

      await t.step("returns 0 when DenopsPluginPre", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginPre:dummyIsLoadedInvalid']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 1 when DenopsPluginFail", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginFail:dummyIsLoadedInvalid']",
        );
        assertEquals(actual, 1);
      });

      await t.step("returns 1 after DenopsPluginFail", async () => {
        const actual = await host.call(
          "denops#plugin#is_loaded",
          "dummyIsLoadedInvalid",
        );
        assertEquals(actual, 1);
      });

      await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#load()
    });

    await t.step("if the plugin dispose method throws", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyIsLoadedInvalidDispose', '${scriptInvalidDispose}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyIsLoadedInvalidDispose")
      );
      // Unload plugin and wait failure.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "let g:__test_denops_is_loaded = {}",
        `call denops#plugin#unload('dummyIsLoadedInvalidDispose')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginUnloadFail:dummyIsLoadedInvalidDispose")
      );

      await t.step("returns 0 when DenopsPluginUnloadPre", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginUnloadPre:dummyIsLoadedInvalidDispose']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 when DenopsPluginUnloadFail", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginUnloadFail:dummyIsLoadedInvalidDispose']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 after DenopsPluginUnloadFail", async () => {
        const actual = await host.call(
          "denops#plugin#is_loaded",
          "dummyIsLoadedInvalidDispose",
        );
        assertEquals(actual, 0);
      });

      await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#unload()
    });

    await t.step("if the plugin is loading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "let g:__test_denops_is_loaded = {}",
        `call denops#plugin#load('dummyIsLoadedLoading', '${scriptValid}')`,
        "let g:__test_denops_plugin_is_loaded_after_load = denops#plugin#is_loaded('dummyIsLoadedLoading')",
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyIsLoadedLoading")
      );

      await t.step("returns 0 immediately after `load()`", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_plugin_is_loaded_after_load",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 when DenopsPluginPre", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginPre:dummyIsLoadedLoading']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 1 when DenopsPluginPost", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginPost:dummyIsLoadedLoading']",
        );
        assertEquals(actual, 1);
      });

      await t.step("returns 1 after DenopsPluginPost", async () => {
        const actual = await host.call(
          "denops#plugin#is_loaded",
          "dummyIsLoadedLoading",
        );
        assertEquals(actual, 1);
      });
    });

    await t.step("if the plugin is unloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyIsLoadedUnloading', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyIsLoadedUnloading")
      );
      // Unload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "let g:__test_denops_is_loaded = {}",
        `call denops#plugin#unload('dummyIsLoadedUnloading')`,
        "let g:__test_denops_plugin_is_loaded_after_unload = denops#plugin#is_loaded('dummyIsLoadedUnloading')",
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginUnloadPost:dummyIsLoadedUnloading")
      );

      await t.step("returns 0 immediately after `unload()`", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_plugin_is_loaded_after_unload",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 when DenopsPluginUnloadPre", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginUnloadPre:dummyIsLoadedUnloading']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 when DenopsPluginUnloadPost", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginUnloadPost:dummyIsLoadedUnloading']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 after DenopsPluginUnloadPost", async () => {
        const actual = await host.call(
          "denops#plugin#is_loaded",
          "dummyIsLoadedUnloading",
        );
        assertEquals(actual, 0);
      });
    });

    await t.step("if the plugin is reloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyIsLoadedReloading', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyIsLoadedReloading")
      );
      // Reload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        "let g:__test_denops_is_loaded = {}",
        `call denops#plugin#reload('dummyIsLoadedReloading')`,
        "let g:__test_denops_plugin_is_loaded_after_reload = denops#plugin#is_loaded('dummyIsLoadedReloading')",
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyIsLoadedReloading")
      );

      await t.step("returns 0 immediately after `reaload()`", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_plugin_is_loaded_after_reload",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 when DenopsPluginUnloadPre", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginUnloadPre:dummyIsLoadedReloading']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 when DenopsPluginUnloadPost", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginUnloadPost:dummyIsLoadedReloading']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 0 when DenopsPluginPre", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginPre:dummyIsLoadedReloading']",
        );
        assertEquals(actual, 0);
      });

      await t.step("returns 1 when DenopsPluginPost", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_is_loaded['DenopsPluginPost:dummyIsLoadedReloading']",
        );
        assertEquals(actual, 1);
      });

      await t.step("returns 1 after DenopsPluginPost", async () => {
        const actual = await host.call(
          "denops#plugin#is_loaded",
          "dummyIsLoadedReloading",
        );
        assertEquals(actual, 1);
      });
    });
  },
});
