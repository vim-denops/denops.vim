import { assertEquals } from "jsr:@std/assert@^1.0.1";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

testHost({
  name: "denops#server#status()",
  mode: "all",
  postlude: [
    // NOTE: The `plugin/denops.vim` must be sourced to initialize the environment.
    "runtime plugin/denops.vim",
    // NOTE: Disable startup on VimEnter.
    "autocmd! denops_plugin_internal_startup VimEnter",
  ],
  fn: async ({ host, t }) => {
    await t.step(
      "returns 'stopped' when no server running",
      async () => {
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "stopped");
      },
    );

    await host.call("execute", [
      "autocmd User DenopsReady let g:__test_denops_ready_fired = 1",
      "autocmd User DenopsClosed let g:__test_denops_closed_fired = 1",
    ], "");

    // NOTE: The status may transition to `preparing`, so get it within execute.
    // SEE: https://github.com/vim-denops/denops.vim/issues/354
    await host.call("execute", [
      "call denops#server#start()",
      "let g:__test_denops_server_status_when_start_called = denops#server#status()",
      "function! TestDenopsServerStatusBeforeReady(...) abort",
      "  if exists('g:__test_denops_ready_fired') | return 0 | endif",
      "  let g:__test_denops_server_status_before_ready = denops#server#status()",
      "  call timer_start(0, 'TestDenopsServerStatusBeforeReady')",
      "endfunction",
      "call TestDenopsServerStatusBeforeReady()",
    ], "");

    await t.step(
      "returns 'starting' when denops#server#start() is called",
      async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_start_called",
        );
        assertEquals(actual, "starting");
      },
    );

    await t.step(
      "returns 'preparing' before DenopsReady is fired (flaky)",
      async () => {
        await wait(() => host.call("exists", "g:__test_denops_ready_fired"));
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_before_ready",
        );
        assertEquals(actual, "preparing");
      },
    );

    await t.step(
      "returns 'running' after DenopsReady is fired",
      async () => {
        await wait(() => host.call("exists", "g:__test_denops_ready_fired"));
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "running");
      },
    );

    await t.step(
      "returns 'closing' when denops#server#close() is called",
      async () => {
        await host.call("execute", [
          "call denops#server#close()",
          "let g:__test_denops_server_status_when_close_called = denops#server#status()",
        ], "");
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_close_called",
        );
        assertEquals(actual, "closing");
      },
    );

    await t.step(
      "returns 'closed' after DenopsClosed is fired",
      async () => {
        await wait(() => host.call("exists", "g:__test_denops_closed_fired"));
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "closed");
      },
    );

    await t.step(
      "returns 'stopped' after denops#server#stop() is called",
      async () => {
        await host.call("denops#server#stop");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
      },
    );
  },
});
