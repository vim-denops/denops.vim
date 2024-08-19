import {
  assert,
  assertEquals,
  assertFalse,
  assertMatch,
  assertNotMatch,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1/delay";
import { AsyncDisposableStack } from "jsr:@nick/dispose@^1.1.0/async-disposable-stack";
import { testHost } from "/denops-testutil/host.ts";
import { useSharedServer } from "/denops-testutil/shared_server.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200;

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

    await t.step(
      "if the server is stopped with a constraint error (issue 401)",
      async (t) => {
        await using stack = new AsyncDisposableStack();
        stack.defer(async () => {
          await host.call("denops#server#stop");
          await wait(
            () => host.call("eval", "denops#server#status() ==# 'stopped'"),
          );
        });

        outputs = [];
        await host.call("execute", [
          "silent! unlet g:__test_denops_process_stopped_fired",
          `let g:denops#server#deno_args = ['${
            resolve("no_check/cli_constraint_error_on_issue_401.ts")
          }']`,
          "let g:denops#server#restart_delay = 1000",
          "let g:denops#server#restart_interval = 10000",
          "let g:denops#server#restart_threshold = 1",
          "call denops#server#start()",
        ], "");

        await t.step("fires DenopsProcessStopped", async () => {
          await wait(() =>
            host.call("exists", "g:__test_denops_process_stopped_fired")
          );
        });

        await t.step("changes status to 'stopped' asynchronously", async () => {
          assertEquals(await host.call("denops#server#status"), "stopped");
        });

        await t.step("outputs warning message", async () => {
          await delay(MESSAGE_DELAY);
          assertStringIncludes(
            outputs.join(""),
            "Execute 'call denops#cache#update(#{reload: v:true})' and restart Vim/Neovim.",
          );
        });

        await t.step("does not restart the server", () => {
          assertNotMatch(
            outputs.join(""),
            /Server stopped.*Restarting/,
          );
        });
      },
    );
  },
});

/** Resolve testdata script URL. */
function resolve(path: string): string {
  return new URL(`../../../testdata/${path}`, import.meta.url).href;
}
