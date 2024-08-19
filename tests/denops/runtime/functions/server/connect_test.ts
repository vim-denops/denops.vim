import {
  assert,
  assertEquals,
  assertFalse,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1/delay";
import { AsyncDisposableStack } from "jsr:@nick/dispose@^1.1.0/async-disposable-stack";
import { testHost } from "/denops-testutil/host.ts";
import { useSharedServer } from "/denops-testutil/shared_server.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200;

testHost({
  name: "denops#server#connect()",
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
      "autocmd User DenopsReady let g:__test_denops_ready_fired = 1",
      "autocmd User DenopsClosed let g:__test_denops_closed_fired = 1",
    ], "");

    await t.step("if denops disabled", async (t) => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        await host.call("execute", [
          "let g:denops#disabled = 0",
        ], "");
      });

      await host.call("execute", [
        "let g:denops#disabled = 1",
        "let g:__test_denops_server_connect_result = denops#server#connect()",
        "let g:__test_denops_server_status_when_connect_called = denops#server#status()",
      ], "");

      await t.step("returns falsy", async () => {
        assertFalse(
          await host.call("eval", "g:__test_denops_server_connect_result"),
        );
      });

      await t.step("does not change status from 'stopped'", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_connect_called",
        );
        assertEquals(actual, "stopped");
      });
    });

    await t.step("if not yet connected", async (t) => {
      await t.step("if `g:denops_server_addr` is empty", async (t) => {
        outputs = [];

        await host.call("execute", [
          `let g:denops_server_addr = ''`,
          "silent! unlet g:__test_denops_ready_fired",
          "let g:__test_denops_server_connect_result = denops#server#connect()",
          "let g:__test_denops_server_status_when_connect_called = denops#server#status()",
        ], "");

        await t.step("returns falsy", async () => {
          assertFalse(
            await host.call("eval", "g:__test_denops_server_connect_result"),
          );
        });

        await t.step("does not change status from 'stopped'", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_server_status_when_connect_called",
          );
          assertEquals(actual, "stopped");
        });

        await t.step("does not fire DenopsReady", async () => {
          await assertRejects(
            () =>
              wait(
                () => host.call("exists", "g:__test_denops_ready_fired"),
                { timeout: 1000, interval: 100 },
              ),
            Error,
            "Timeout",
          );
        });

        await t.step(
          "does not change `g:denops#disabled` from falsy",
          async () => {
            assertFalse(await host.call("eval", "g:denops#disabled"));
          },
        );

        await t.step("outputs error message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /denops shared server address \(g:denops_server_addr\) is not given/,
          );
        });
      });

      await t.step("if `g:denops_server_addr` is invalid", async (t) => {
        outputs = [];

        // NOTE: Get a non-existent address.
        const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
        const not_exists_address = `127.0.0.1:${listener.addr.port}`;
        listener.close();

        await host.call("execute", [
          `let g:denops_server_addr = '${not_exists_address}'`,
          "let g:denops#server#reconnect_delay = 10",
          "let g:denops#server#reconnect_interval = 30000",
          "let g:denops#server#reconnect_threshold = 3",
          "silent! unlet g:__test_denops_ready_fired",
          "let g:__test_denops_server_connect_result = denops#server#connect()",
          "let g:__test_denops_server_status_when_connect_called = denops#server#status()",
        ], "");

        await t.step("returns falsy", async () => {
          assertFalse(
            await host.call("eval", "g:__test_denops_server_connect_result"),
          );
        });

        await t.step("does not change status from 'stopped'", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_server_status_when_connect_called",
          );
          assertEquals(actual, "stopped");
        });

        await t.step("does not fire DenopsReady", async () => {
          await assertRejects(
            () =>
              wait(
                () => host.call("exists", "g:__test_denops_ready_fired"),
                { timeout: 1000, interval: 100 },
              ),
            Error,
            "Timeout",
          );
        });

        await t.step(
          "does not change `g:denops#disabled` from falsy",
          async () => {
            assertFalse(await host.call("eval", "g:denops#disabled"));
          },
        );

        await t.step("outputs warning message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /Failed to connect channel `127\.0\.0\.1:[0-9]+`:/,
          );
        });
      });

      await t.step("if `g:denops_server_addr` is valid", async (t) => {
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
          "silent! unlet g:__test_denops_ready_fired",
          "let g:__test_denops_server_connect_result = denops#server#connect()",
          "let g:__test_denops_server_status_when_connect_called = denops#server#status()",
        ], "");

        await t.step("returns truthy", async () => {
          assert(
            await host.call("eval", "g:__test_denops_server_connect_result"),
          );
        });

        await t.step("change status to 'preparing' immediately", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_server_status_when_connect_called",
          );
          assertEquals(actual, "preparing");
        });

        await t.step("fires DenopsReady", async () => {
          await wait(() => host.call("exists", "g:__test_denops_ready_fired"));
        });

        await t.step("changes status to 'running' asynchronously", async () => {
          assertEquals(await host.call("denops#server#status"), "running");
        });
      });
    });

    await t.step("if already connected to local-server", async (t) => {
      await using stack = new AsyncDisposableStack();
      const server = stack.use(await useSharedServer());
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
        `let g:denops_server_addr = '${server.addr}'`,
        "call denops#server#connect()",
      ], "");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'running'"),
      );

      await host.call("execute", [
        "silent! unlet g:__test_denops_ready_fired",
        "let g:__test_denops_server_connect_result = denops#server#connect()",
        "let g:__test_denops_server_status_when_connect_called = denops#server#status()",
      ], "");

      await t.step("returns falsy", async () => {
        assertFalse(
          await host.call("eval", "g:__test_denops_server_connect_result"),
        );
      });

      await t.step("does not change status from 'running'", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_connect_called",
        );
        assertEquals(actual, "running");
      });

      await t.step("does not fire DenopsReady", async () => {
        await assertRejects(
          () =>
            wait(
              () => host.call("exists", "g:__test_denops_ready_fired"),
              { timeout: 1000, interval: 100 },
            ),
          Error,
          "Timeout",
        );
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
        "silent! unlet g:__test_denops_ready_fired",
        "let g:__test_denops_server_connect_result = denops#server#connect()",
        "let g:__test_denops_server_status_when_connect_called = denops#server#status()",
      ], "");

      await t.step("returns falsy", async () => {
        assertFalse(
          await host.call("eval", "g:__test_denops_server_connect_result"),
        );
      });

      await t.step("does not change status from 'running'", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_connect_called",
        );
        assertEquals(actual, "running");
      });

      await t.step("does not fire DenopsReady", async () => {
        await assertRejects(
          () =>
            wait(
              () => host.call("exists", "g:__test_denops_ready_fired"),
              { timeout: 1000, interval: 100 },
            ),
          Error,
          "Timeout",
        );
      });
    });

    await t.step("if the channel is closed unexpectedly", async (t) => {
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
        "let g:denops#server#reconnect_delay = 1000",
        "let g:denops#server#reconnect_interval = 1000",
        "let g:denops#server#reconnect_threshold = 1",
        "call denops#server#connect()",
      ], "");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'running'"),
      );
      await host.call("execute", [
        "silent! unlet g:__test_denops_closed_fired",
      ], "");
      outputs = [];

      // Close the channel by stop the shared-server.
      await server[Symbol.asyncDispose]();

      await t.step("fires DenopsClosed", async () => {
        await wait(() => host.call("exists", "g:__test_denops_closed_fired"));
      });

      await t.step("changes status to 'stopped' asynchronously", async () => {
        assertEquals(await host.call("denops#server#status"), "stopped");
      });

      await t.step("reconnect to the server", async (t) => {
        await host.call("execute", [
          "silent! unlet g:__test_denops_ready_fired",
        ], "");

        // Start the shared-server with the same port number.
        stack.use(await useSharedServer({ port: server.addr.port }));

        await t.step("fires DenopsReady", async () => {
          await wait(() => host.call("exists", "g:__test_denops_ready_fired"));
        });

        await t.step("changes status to 'running' asynchronously", async () => {
          assertEquals(await host.call("denops#server#status"), "running");
        });

        await t.step("outputs warning message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /Channel closed\. Reconnecting\.\.\./,
          );
        });
      });
    });

    await t.step("if reconnect count exceed", async (t) => {
      await using stack = new AsyncDisposableStack();
      const listener = stack.use(
        Deno.listen({ hostname: "127.0.0.1", port: 0 }),
      );
      stack.defer(async () => {
        await host.call("denops#server#close");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
        await host.call("execute", [
          "let g:denops#disabled = 0",
        ], "");
      });

      await host.call("execute", [
        `let g:denops_server_addr = '127.0.0.1:${listener.addr.port}'`,
        "let g:denops#server#reconnect_delay = 10",
        "let g:denops#server#reconnect_interval = 30000",
        "let g:denops#server#reconnect_threshold = 3",
        "call denops#server#connect()",
      ], "");
      outputs = [];

      // Close the channel from server side.
      (async () => {
        for await (const conn of listener) {
          conn.close();
        }
      })();

      await t.step("changes `g:denops#disabled` to truthy", async () => {
        await wait(() => host.call("eval", "g:denops#disabled"));
      });

      await t.step("changes status to 'stopped'", async () => {
        assertEquals(await host.call("denops#server#status"), "stopped");
      });

      await t.step("outputs warning message after delayed", async () => {
        await delay(MESSAGE_DELAY);
        assertMatch(
          outputs.join(""),
          /Channel closed 4 times within 30000 millisec/,
        );
      });
    });
  },
});
