import {
  assertArrayIncludes,
  assertEquals,
  assertLess,
  assertRejects,
} from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1";
import { join } from "jsr:@std/path@^1.0.2/join";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200; // msc

const scriptValid = resolve("dummy_valid_plugin.ts");
const scriptInvalid = resolve("dummy_invalid_plugin.ts");
const scriptValidWait = resolve("dummy_valid_wait_plugin.ts");
const scriptInvalidWait = resolve("dummy_invalid_wait_plugin.ts");

testHost({
  name: "denops#plugin#wait_async()",
  mode: "all",
  postlude: [
    "runtime plugin/denops.vim",
  ],
  fn: async ({ host, t }) => {
    await wait(() => host.call("eval", "denops#server#status() ==# 'running'"));
    await host.call("execute", [
      "let g:__test_denops_events = []",
      "autocmd User DenopsPlugin* call add(g:__test_denops_events, expand('<amatch>'))",
    ], "");

    await t.step("if the plugin name is invalid", async (t) => {
      await t.step("throws an error", async () => {
        // NOTE: '.' is not allowed in plugin name.
        await assertRejects(
          () =>
            host.call("execute", [
              "call denops#plugin#wait_async('dummy.invalid', { -> 0 })",
            ], ""),
          Error,
          "Invalid plugin name: dummy.invalid",
        );
      });
    });

    await t.step("if the plugin is load asynchronously", async (t) => {
      // Load plugin asynchronously.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call timer_start(1000, { -> denops#plugin#load('dummyWaitAsyncLoadAsync', '${scriptValid}') })`,
      ], "");

      await host.call("execute", [
        "let g:__test_denops_wait_start = reltime()",
        "call denops#plugin#wait_async('dummyWaitAsyncLoadAsync', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncLoadAsync') })",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("does not call `callback` immediately", async () => {
        const actual =
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
        assertEquals(actual, []);
      });

      await t.step("calls `callback` when the plugin is loaded", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitAsyncLoadAsync")
        );
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          ["WaitAsyncCallbackCalled:dummyWaitAsyncLoadAsync"],
        );
      });
    });

    await t.step("if the plugin is loading", async (t) => {
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitAsyncLoading', '${scriptValidWait}')`,
        "let g:__test_denops_wait_start = reltime()",
        "call denops#plugin#wait_async('dummyWaitAsyncLoading', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncLoading') })",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("does not call `callback` immediately", async () => {
        const actual =
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
        assertEquals(actual, []);
      });

      await t.step("calls `callback` when the plugin is loaded", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitAsyncLoading")
        );
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          ["WaitAsyncCallbackCalled:dummyWaitAsyncLoading"],
        );
      });
    });

    await t.step("if the plugin is loaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        `call denops#plugin#load('dummyWaitAsyncLoaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyWaitAsyncLoaded")
      );

      await host.call("execute", [
        "let g:__test_denops_events = []",
        "let g:__test_denops_wait_start = reltime()",
        "call denops#plugin#wait_async('dummyWaitAsyncLoaded', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncLoaded') })",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("calls `callback` immediately", async () => {
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          ["WaitAsyncCallbackCalled:dummyWaitAsyncLoaded"],
        );
      });
    });

    await t.step("if the plugin is reloading", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitAsyncReloading', '${scriptValidWait}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyWaitAsyncReloading")
      );

      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyWaitAsyncReloading')`,
        "let g:__test_denops_wait_start = reltime()",
        "call denops#plugin#wait_async('dummyWaitAsyncReloading', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncReloading') })",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("does not call `callback` immediately", async () => {
        const actual =
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
        assertEquals(actual, []);
      });

      await t.step("calls `callback` when the plugin is loaded", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitAsyncReloading")
        );
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          ["WaitAsyncCallbackCalled:dummyWaitAsyncReloading"],
        );
      });
    });

    await t.step("if the plugin is reloaded", async (t) => {
      // Load plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitAsyncReloaded', '${scriptValid}')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyWaitAsyncReloaded")
      );
      // Reload plugin and wait.
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#reload('dummyWaitAsyncReloaded')`,
      ], "");
      await wait(async () =>
        (await host.call("eval", "g:__test_denops_events") as string[])
          .includes("DenopsPluginPost:dummyWaitAsyncReloaded")
      );

      await host.call("execute", [
        "let g:__test_denops_events = []",
        "let g:__test_denops_wait_start = reltime()",
        "call denops#plugin#wait_async('dummyWaitAsyncReloaded', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncReloaded') })",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("calls `callback` immediately", async () => {
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          ["WaitAsyncCallbackCalled:dummyWaitAsyncReloaded"],
        );
      });
    });

    await t.step("if the plugin is loading and fails", async (t) => {
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#load('dummyWaitAsyncLoadingAndFails', '${scriptInvalidWait}')`,
        "let g:__test_denops_wait_start = reltime()",
        "call denops#plugin#wait_async('dummyWaitAsyncLoadingAndFails', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncLoadingAndFails') })",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("does not call `callback`", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginFail:dummyWaitAsyncLoadingAndFails")
        );
        const actual =
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
        assertEquals(actual, []);
      });

      await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#load()
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
        "call denops#plugin#wait_async('dummyWaitAsyncFailed', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncFailed') })",
        "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
      ], "");

      await t.step("returns immediately", async () => {
        const elapsed_sec = await host.call(
          "eval",
          "g:__test_denops_wait_elapsed",
        ) as number;
        assertLess(elapsed_sec, 0.1);
      });

      await t.step("does not call `callback`", async () => {
        const actual =
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
        assertEquals(actual, []);
      });

      await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#load()
    });
  },
});

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../../../testdata/${path}`);
}
