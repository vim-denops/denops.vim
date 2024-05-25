import { assertEquals } from "jsr:@std/assert@0.225.2";
import { testHost } from "../../denops/@denops-private/testutil/host.ts";
import { wait } from "../../denops/@denops-private/testutil/wait.ts";

testHost({
  name: "denops#server#status()",
  mode: "all",
  fn: async (host, t) => {
    await host.call("execute", [
      "autocmd User DenopsReady let g:denops_ready_fired = 1",
      "autocmd User DenopsClosed let g:denops_closed_fired = 1",
    ], "");

    await t.step(
      "returns 'stopped' when no server running",
      async () => {
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "stopped");
      },
    );

    await t.step(
      "returns 'starting' when denops#server#start() is called",
      async () => {
        await host.call("denops#server#start");
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "starting");
      },
    );

    await t.step(
      "returns 'preparing' before DenopsReady is fired",
      async () => {
        const actual = await wait(() =>
          host.call(
            "eval",
            "exists('g:denops_ready_fired') ? 'DenopsReady is fired'" +
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
  verbose: true,
  fn: async (host, t) => {
    await host.call("execute", [
      "autocmd User DenopsReady let g:denops_ready_fired = 1",
      "autocmd User DenopsClosed let g:denops_closed_fired = 1",
      "source plugin/denops.vim",
    ], "");

    await t.step(
      "'plugin/denops.vim' changes status to 'starting' when sourced",
      async () => {
        const actual = await host.call("denops#server#status");
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

    await t.step(
      "denops#server#close() closes the connection then DenopsClosed is fired",
      async () => {
        await host.call("denops#server#close");
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
