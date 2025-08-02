import { assert, assertEquals, assertMatch, assertRejects } from "@std/assert";
import { delay } from "@std/async/delay";
import { AsyncDisposableStack } from "@nick/dispose/async-disposable-stack";
import { testHost } from "/denops-testutil/host.ts";
import { useSharedServer } from "/denops-testutil/shared_server.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200;

testHost({
  name: "denops#server#close()",
  mode: "all",
  postlude: [
    // NOTE: The `plugin/denops.vim` must be sourced to initialize the environment.
    "runtime plugin/denops.vim",
    // NOTE: Disable startup on VimEnter.
    "autocmd! denops_plugin_internal_startup VimEnter",
  ],
  fn: async ({ host, t, stderr }) => {
    let outputs: string[] = [];
    stderr.pipeTo(
      new WritableStream({ write: (s) => void outputs.push(s) }),
    ).catch(() => {});

    await host.call("execute", [
      "autocmd User DenopsClosed let g:__test_denops_closed_fired = 1",
    ], "");

    await t.step("if not yet connected", async (t) => {
      await host.call("execute", [
        "silent! unlet g:__test_denops_closed_fired",
        "call denops#server#close()",
        "let g:__test_denops_server_status_when_close_called = denops#server#status()",
      ], "");

      await t.step("does not change status from 'stopped'", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_close_called",
        );
        assertEquals(actual, "stopped");
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
        "call denops#server#close()",
        "let g:__test_denops_server_status_when_close_called = denops#server#status()",
        "silent! unlet g:__test_denops_closed_fired",
      ], "");

      await t.step("changes status to 'closing' immediately", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_close_called",
        );
        assertEquals(actual, "closing");
      });

      await t.step("fires DenopsClosed", async () => {
        await wait(() => host.call("exists", "g:__test_denops_closed_fired"));
      });

      await t.step("changes status to 'closed' asynchronously", async () => {
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "closed");
      });

      await t.step("does not stop the local-server", async () => {
        await assertRejects(
          () =>
            wait(
              () => host.call("eval", "denops#server#status() ==# 'stopped'"),
              { timeout: 1000, interval: 100 },
            ),
          Error,
          "Timeout",
        );
      });

      await host.call("denops#server#stop");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'stopped'"),
      );
      await host.call("denops#server#start");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'running'"),
      );

      await t.step("if timeouted", async (t) => {
        outputs = [];

        await host.call("execute", [
          "silent! unlet g:__test_denops_closed_fired",
          "let g:denops#server#close_timeout = 0",
          "call denops#server#close()",
        ], "");

        await host.call("execute", [
          "let g:__test_denops_server_status_after_close_called = denops#server#status()",
        ], "");

        await t.step("closes the channel forcibly", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_server_status_after_close_called",
          );
          assertEquals(actual, "closed");
        });

        await t.step("fires DenopsClosed", async () => {
          assert(await host.call("exists", "g:__test_denops_closed_fired"));
        });

        await t.step("outputs warning message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /Channel cannot close gracefully within 0 millisec, force close/,
          );
        });

        await t.step("does not stop the local-server", async () => {
          await assertRejects(
            () =>
              wait(
                () => host.call("eval", "denops#server#status() ==# 'stopped'"),
                { timeout: 1000, interval: 100 },
              ),
            Error,
            "Timeout",
          );
        });
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
        "call denops#server#close()",
        "let g:__test_denops_server_status_when_close_called = denops#server#status()",
        "silent! unlet g:__test_denops_closed_fired",
      ], "");

      await t.step("changes status to 'closing' immediately", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_close_called",
        );
        assertEquals(actual, "closing");
      });

      await t.step("fires DenopsClosed", async () => {
        await wait(() => host.call("exists", "g:__test_denops_closed_fired"));
      });

      await t.step("changes status to 'stopped' asynchronously", async () => {
        assertEquals(await host.call("denops#server#status"), "stopped");
      });

      await host.call("denops#server#connect");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'running'"),
      );

      await t.step("if timeouted", async (t) => {
        outputs = [];

        await host.call("execute", [
          "silent! unlet g:__test_denops_closed_fired",
          "let g:denops#server#close_timeout = 0",
          "call denops#server#close()",
        ], "");

        // Wait for times out
        await delay(10);

        await host.call("execute", [
          "let g:__test_denops_server_status_after_close_called = denops#server#status()",
        ], "");

        await t.step("closes the channel forcibly (flaky)", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_server_status_after_close_called",
          );
          assertEquals(actual, "stopped");
        });

        await t.step("fires DenopsClosed (flaky)", async () => {
          assert(await host.call("exists", "g:__test_denops_closed_fired"));
        });

        await t.step("outputs warning message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /Channel cannot close gracefully within 0 millisec, force close/,
          );
        });
      });
    });
  },
});
