import {
  assertEquals,
  assertFalse,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@^1.0.1";
import { AsyncDisposableStack } from "jsr:@nick/dispose@^1.1.0/async-disposable-stack";
import { testHost } from "/denops-testutil/host.ts";
import { useSharedServer } from "/denops-testutil/shared_server.ts";
import { wait } from "/denops-testutil/wait.ts";

testHost({
  name: "denops#server#stop()",
  mode: "all",
  postlude: [
    // NOTE: The `plugin/denops.vim` must be sourced to initialize the environment.
    "runtime plugin/denops.vim",
    // NOTE: Disable startup on VimEnter.
    "autocmd! denops_plugin_internal_startup VimEnter",
  ],
  fn: async ({ host, t }) => {
    await host.call("execute", [
      "autocmd User DenopsClosed let g:__test_denops_closed_fired = 1",
      "autocmd User DenopsProcessStopped:* let g:__test_denops_process_stopped_fired = expand('<amatch>')",
    ], "");

    await t.step("if not yet started", async (t) => {
      await host.call("execute", [
        "call denops#server#stop()",
        "let g:__test_denops_server_status_when_stop_called = denops#server#status()",
      ], "");

      await t.step("does not change status from 'stopped'", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_stop_called",
        );
        assertEquals(actual, "stopped");
      });
    });

    await t.step("if already connected to local-server", async (t) => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        await host.call("denops#server#stop");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
      });
      await host.call("denops#server#start");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'running'"),
      );

      await host.call("execute", [
        "call denops#server#stop()",
        "let g:__test_denops_server_status_when_stop_called = denops#server#status()",
        "silent! unlet g:__test_denops_closed_fired",
        "silent! unlet g:__test_denops_process_stopped_fired",
      ], "");

      await t.step("changes status to 'closing' immediately", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_stop_called",
        );
        assertEquals(actual, "closing");
      });

      await t.step("fires DenopsClosed", async () => {
        await wait(() => host.call("exists", "g:__test_denops_closed_fired"));
      });

      await t.step("fires DenopsProcessStopped:*", async () => {
        const actual = await wait(() =>
          host.call("eval", "get(g:, '__test_denops_process_stopped_fired')")
        );
        assertMatch(actual as string, /^DenopsProcessStopped:-?[0-9]+/);
      });

      await t.step("changes status to 'stopped' asynchronously", async () => {
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "stopped");
      });
    });

    await t.step("if already connected to shared-server", async (t) => {
      await using stack = new AsyncDisposableStack();
      const server = stack.use(await useSharedServer());
      stack.defer(async () => {
        await host.call("denops#server#close");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
      });

      await host.call("execute", [
        `let g:denops_server_addr = '${server.addr}'`,
        "call denops#server#connect()",
      ], "");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'running'"),
      );

      await host.call("execute", [
        "silent! unlet g:__test_denops_closed_fired",
        "silent! unlet g:__test_denops_process_stopped_fired",
        "call denops#server#stop()",
        "let g:__test_denops_server_status_when_stop_called = denops#server#status()",
      ], "");

      await t.step("does not change status from 'running'", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_stop_called",
        );
        assertEquals(actual, "running");
      });

      await t.step("does not fire DenopsClosed", async () => {
        await assertRejects(
          () =>
            wait(
              () => host.call("exists", "g:__test_denops_closed_fired"),
              { timeout: 1000, interval: 100 },
            ),
          Error,
          "Timeout",
        );
      });

      await t.step("does not fire DenopsProcessStopped:*", async () => {
        // NOTE: The timeout test is performed in `does not fire DenopsClosed`.
        assertFalse(
          await host.call("exists", "g:__test_denops_process_stopped_fired"),
        );
      });
    });
  },
});
