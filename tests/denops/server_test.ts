import { assertEquals, assertFalse } from "jsr:@std/assert@0.225.2";
import { testHost } from "../../denops/@denops-private/testutil/host.ts";
import { wait } from "../../denops/@denops-private/testutil/wait.ts";

testHost({
  name: "denops#server#status()",
  mode: "all",
  fn: async (host, t) => {
    await t.step(
      "returns 'stopped' when no server running",
      async () => {
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "stopped");
      },
    );

    // NOTE: The `plugin/denops.vim` must be sourced to initialize the environment.
    await host.call("execute", [
      "source plugin/denops.vim",
      "autocmd User DenopsReady let g:denops_ready_fired = 1",
      "autocmd User DenopsClosed let g:denops_closed_fired = 1",
    ], "");

    // Wait to stopped the server that starts by `plugin/denops.vim`
    await wait(() => host.call("exists", "g:denops_ready_fired"));
    await host.call("denops#server#stop");
    await wait(() => host.call("eval", "denops#server#status() ==# 'stopped'"));

    // NOTE: The status may transition to `preparing`, so get it within execute.
    // SEE: https://github.com/vim-denops/denops.vim/issues/354
    await host.call("execute", [
      "unlet g:denops_ready_fired",
      "unlet g:denops_closed_fired",
      "call denops#server#start()",
      "let g:__test_denops_server_status_when_start_called = denops#server#status()",
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
        const actual = await wait(() =>
          host.call(
            "eval",
            "exists('g:denops_ready_fired') ? 'DenopsReady is fired (flaky result)'" +
              ": denops#server#status() !=# 'starting' ? denops#server#status() : 0",
          )
        );
        assertEquals(actual, "preparing");
      },
    );

    await t.step(
      "returns 'running' after DenopsReady is fired",
      async () => {
        await wait(() => host.call("exists", "g:denops_ready_fired"));
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "running");
      },
    );

    await t.step(
      "returns 'stopped' after denops#server#stop() is called",
      async () => {
        await host.call("denops#server#stop");
        await wait(() =>
          host.call("eval", "denops#server#status() ==# 'stopped'")
        );
      },
    );
  },
});

testHost({
  name: "Denops server",
  mode: "all",
  fn: async (host, t) => {
    // NOTE: The status may transition to `preparing`, so get it within execute.
    // SEE: https://github.com/vim-denops/denops.vim/issues/354
    await host.call("execute", [
      "autocmd User DenopsReady let g:denops_ready_fired = 1",
      "autocmd User DenopsClosed let g:denops_closed_fired = 1",
      "source plugin/denops.vim",
      "let g:__test_denops_server_status_on_sourced = denops#server#status()",
    ], "");

    await t.step(
      "'plugin/denops.vim' changes status to 'starting' when sourced",
      async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_on_sourced",
        );
        assertEquals(actual, "starting");
      },
    );

    await t.step(
      "denops#server#status() returns 'running' after DenopsReady is fired",
      async () => {
        await wait(() => host.call("exists", "g:denops_ready_fired"));
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "running");
      },
    );

    await host.call("execute", [
      "call denops#server#close()",
      "let g:__test_denops_server_denops_closed_exists_after_close = exists('g:denops_closed_fired')",
    ], "");

    await t.step(
      "denops#server#close() closes the connection asynchronously then DenopsClosed is fired",
      async () => {
        assertFalse(
          await host.call(
            "eval",
            "g:__test_denops_server_denops_closed_exists_after_close",
          ),
        );
        await wait(() => host.call("exists", "g:denops_closed_fired"));
      },
    );

    await t.step(
      "denops#server#stop() stops the server process asynchronously",
      async () => {
        await host.call("denops#server#stop");
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "stopped");
      },
    );
  },
});
