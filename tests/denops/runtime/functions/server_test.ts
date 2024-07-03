import {
  assert,
  assertEquals,
  assertFalse,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@0.225.2";
import { delay } from "jsr:@std/async@^0.224.0/delay";
import { AsyncDisposableStack } from "jsr:@nick/dispose@1.1.0/async-disposable-stack";
import { testHost } from "/denops-testutil/host.ts";
import { useSharedServer } from "/denops-testutil/shared_server.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200;

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
            "exists('g:__test_denops_ready_fired')" +
              "? 'DenopsReady is fired (flaky result)'" +
              ": denops#server#status() !=# 'starting'" +
              "  ? denops#server#status() : 0",
          )
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

testHost({
  name: "denops#server#start()",
  mode: "all",
  postlude: [
    // NOTE: The `plugin/denops.vim` must be sourced to initialize the environment.
    "runtime plugin/denops.vim",
    // NOTE: Disable startup on VimEnter.
    "autocmd! denops_plugin_internal_startup VimEnter",
  ],
  fn: async ({ mode, host, t, stderr }) => {
    let outputs: string[] = [];
    stderr.pipeTo(
      new WritableStream({ write: (s) => void outputs.push(s) }),
    ).catch(() => {});

    async function forceShutdownServer() {
      const serverPid = await host.call(
        "eval",
        mode === "vim"
          ? "job_info(denops#_internal#server#proc#_get_job_for_test()).process"
          : "jobpid(denops#_internal#server#proc#_get_job_for_test())",
      ) as number;
      Deno.kill(serverPid, "SIGKILL");
    }

    await host.call("execute", [
      "autocmd User DenopsReady let g:__test_denops_ready_fired = 1",
      "autocmd User DenopsClosed let g:__test_denops_closed_fired = 1",
      "autocmd User DenopsProcessStarted let g:__test_denops_process_started_fired = 1",
      "autocmd User DenopsProcessStopped:* let g:__test_denops_process_stopped_fired = expand('<amatch>')",
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
        "let g:__test_denops_server_start_result = denops#server#start()",
        "let g:__test_denops_server_status_when_start_called = denops#server#status()",
      ], "");

      await t.step("returns falsy", async () => {
        assertFalse(
          await host.call("eval", "g:__test_denops_server_start_result"),
        );
      });

      await t.step("does not change status from 'stopped'", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_start_called",
        );
        assertEquals(actual, "stopped");
      });
    });

    await t.step("if not yet started", async (t) => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        await host.call("denops#server#stop");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
      });

      await host.call("execute", [
        "silent! unlet g:__test_denops_ready_fired",
        "silent! unlet g:__test_denops_process_started_fired",
        "let g:__test_denops_server_start_result = denops#server#start()",
        "let g:__test_denops_server_status_when_start_called = denops#server#status()",
      ], "");

      await t.step("returns truthy", async () => {
        assert(await host.call("eval", "g:__test_denops_server_start_result"));
      });

      await t.step("changes status to 'starting' immediately", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_start_called",
        );
        assertEquals(actual, "starting");
      });

      await t.step("fires DenopsProcessStarted", async () => {
        await wait(() =>
          host.call("exists", "g:__test_denops_process_started_fired")
        );
      });

      await t.step("fires DenopsReady", async () => {
        await wait(() => host.call("exists", "g:__test_denops_ready_fired"));
      });

      await t.step("changes status to 'running' asynchronously", async () => {
        const actual = await host.call("denops#server#status");
        assertEquals(actual, "running");
      });
    });

    await t.step("if already starting", async (t) => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        // FIXME: Without this block, Neovim cannot stop the server.
        if (await host.call("denops#server#status") !== "stopped") {
          await wait(
            () => host.call("eval", "denops#server#status() ==# 'running'"),
          );
        }

        await host.call("denops#server#stop");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
      });

      await host.call("execute", [
        // First call, changes state to 'starting'.
        "call denops#server#start()",
        // 2nd call, do nothing.
        "let g:__test_denops_server_start_result_2nd = denops#server#start()",
        "let g:__test_denops_server_status_2nd = denops#server#status()",
      ], "");
      await host.call("execute", [
        // 3rd call with asynchronously, do nothing.
        "let g:__test_denops_server_start_result_3rd = denops#server#start()",
        "let g:__test_denops_server_status_3rd = denops#server#status()",
      ], "");

      await t.step("returns falsy", async () => {
        assertFalse(
          await host.call("eval", "g:__test_denops_server_start_result_2nd"),
        );
        assertFalse(
          await host.call("eval", "g:__test_denops_server_start_result_3rd"),
        );
      });

      await t.step("does not change status from 'running'", async () => {
        const actual = await host.call(
          "eval",
          "[g:__test_denops_server_status_2nd, g:__test_denops_server_status_3rd]",
        );
        assertEquals(actual, ["starting", "starting"]);
      });
    });

    await t.step("if already connected to shared-server", async (t) => {
      outputs = [];
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
        "let g:__test_denops_server_start_result = denops#server#start()",
        "let g:__test_denops_server_status_when_start_called = denops#server#status()",
      ], "");

      await t.step("returns falsy", async () => {
        assertFalse(
          await host.call("eval", "g:__test_denops_server_start_result"),
        );
      });

      await t.step("does not change status from 'running'", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_start_called",
        );
        assertEquals(actual, "running");
      });

      await t.step("outputs warning message after delayed", async () => {
        await delay(MESSAGE_DELAY);
        assertMatch(
          outputs.join(""),
          /Not starting local server, already connected to /,
        );
      });
    });

    await t.step("if `deno` command is not exists", async (t) => {
      await using stack = new AsyncDisposableStack();
      const saved_deno_path = await host.call("eval", "g:denops#server#deno");
      stack.defer(async () => {
        await host.call("denops#server#stop");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
        await host.call("execute", [
          `let g:denops#server#deno = '${saved_deno_path}'`,
          `let g:denops#disabled = 0`,
        ], "");
      });

      await host.call("execute", [
        "silent! unlet g:__test_denops_process_stopped_fired",
        "let g:denops#server#deno = '__test_no_exists_deno_executable_path'",
        "let g:denops#server#restart_threshold = 0",
        "let g:__test_denops_server_start_result = denops#server#start()",
        "let g:__test_denops_server_status_when_start_called = denops#server#status()",
      ], "");

      await t.step("returns truthy", async () => {
        assert(await host.call("eval", "g:__test_denops_server_start_result"));
      });

      await t.step("changes status to 'starting' immediately", async () => {
        const actual = await host.call(
          "eval",
          "g:__test_denops_server_status_when_start_called",
        );
        assertEquals(actual, "starting");
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

      await t.step("outputs warning message after delay", async () => {
        await delay(MESSAGE_DELAY);
        assertMatch(
          outputs.join(""),
          /Server stopped 1 times .* Denops is disabled/,
        );
      });

      await t.step("changes `g:denops#disabled` to truthy", async () => {
        assert(await host.call("eval", "g:denops#disabled"));
      });
    });

    await t.step("if the server is stopped unexpectedly", async (t) => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        await host.call("denops#server#stop");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
      });

      await host.call("execute", [
        "let g:denops#server#restart_delay = 1000",
        "let g:denops#server#restart_interval = 1000",
        "let g:denops#server#restart_threshold = 1",
        "call denops#server#start()",
      ], "");
      await wait(
        () => host.call("eval", "denops#server#status() ==# 'running'"),
      );
      await host.call("execute", [
        "silent! unlet g:__test_denops_ready_fired",
        "silent! unlet g:__test_denops_closed_fired",
        "silent! unlet g:__test_denops_process_started_fired",
        "silent! unlet g:__test_denops_process_stopped_fired",
      ], "");
      outputs = [];

      await forceShutdownServer();

      await t.step("fires DenopsClosed", async () => {
        await wait(() => host.call("exists", "g:__test_denops_closed_fired"));
      });

      await t.step("fires DenopsProcessStopped", async () => {
        await wait(() =>
          host.call("exists", "g:__test_denops_process_stopped_fired")
        );
      });

      await t.step("changes status to 'stopped' asynchronously", async () => {
        assertEquals(await host.call("denops#server#status"), "stopped");
      });

      await t.step("restart the server", async (t) => {
        await t.step("fires DenopsProcessStarted", async () => {
          await wait(() =>
            host.call("exists", "g:__test_denops_process_started_fired")
          );
        });

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
            /Server stopped \(-?[0-9]+\)\. Restarting\.\.\./,
          );
        });
      });
    });

    await t.step("if restart count exceed", async (t) => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        await host.call("denops#server#stop");
        await wait(
          () => host.call("eval", "denops#server#status() ==# 'stopped'"),
        );
        await host.call("execute", [
          `let g:denops#disabled = 0`,
        ], "");
      });

      await host.call("execute", [
        "silent! unlet g:__test_denops_process_started_fired",
        "let g:denops#server#restart_delay = 10",
        "let g:denops#server#restart_interval = 30000",
        "let g:denops#server#restart_threshold = 3",
        "call denops#server#start()",
      ], "");
      outputs = [];

      for (let i = 0; i < 4; i++) {
        await wait(() =>
          host.call("exists", "g:__test_denops_process_started_fired")
        );
        await host.call("execute", [
          "unlet g:__test_denops_process_started_fired",
        ], "");
        await forceShutdownServer();
      }

      await t.step("changes `g:denops#disabled` to truthy", async () => {
        await wait(() => host.call("eval", "g:denops#disabled"));
      });

      await t.step("changes status to 'stopped'", async () => {
        await wait(() =>
          host.call("eval", "denops#server#status() ==# 'stopped'")
        );
      });

      await t.step("outputs warning message after delayed", async () => {
        await delay(MESSAGE_DELAY);
        assertMatch(
          outputs.join(""),
          /Server stopped 4 times within 30000 millisec/,
        );
      });
    });
  },
});

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

        await host.call("execute", [
          "let g:__test_denops_server_status_after_close_called = denops#server#status()",
        ], "");

        await t.step("closes the channel forcibly", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_server_status_after_close_called",
          );
          assertEquals(actual, "stopped");
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
      });
    });
  },
});
