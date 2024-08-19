import { assertEquals, assertMatch } from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1/delay";
import { withHost } from "/denops-testutil/host.ts";
import { useSharedServer } from "/denops-testutil/shared_server.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200;
const MODES = ["vim", "nvim"] as const;

for (const mode of MODES) {
  Deno.test(`plugin/denops.vim (${mode})`, async (t) => {
    await t.step("if sourced before VimEnter", async (t) => {
      await t.step("if `g:denops_server_addr` is not specified", async (t) => {
        await withHost({
          mode,
          postlude: [
            "let g:__test_denops_events = []",
            "autocmd User DenopsProcessStarted call add(g:__test_denops_events, 'DenopsProcessStarted')",
            "autocmd User DenopsReady call add(g:__test_denops_events, 'DenopsReady')",
            // Test target
            "runtime plugin/denops.vim",
            "let g:__test_denops_server_status_before_vimenter = denops#server#status()",
          ],
          fn: async ({ host, stderr }) => {
            const outputs: string[] = [];
            stderr.pipeTo(
              new WritableStream({ write: (s) => void outputs.push(s) }),
            ).catch(() => {});
            await t.step(
              "does not start a local server before VimEnter",
              async () => {
                const actual = await host.call(
                  "eval",
                  "g:__test_denops_server_status_before_vimenter",
                );
                assertEquals(actual, "stopped");
              },
            );

            await wait(
              () => host.call("eval", "denops#server#status() ==# 'running'"),
            );

            await t.step("starts a local server", async () => {
              assertEquals(
                await host.call("eval", "g:__test_denops_events"),
                ["DenopsProcessStarted", "DenopsReady"],
              );
            });

            await t.step("does not output messages", async () => {
              await delay(MESSAGE_DELAY);
              assertEquals(outputs, []);
            });
          },
        });
      });

      await t.step("if `g:denops_server_addr` is empty", async (t) => {
        await withHost({
          mode,
          postlude: [
            "let g:__test_denops_events = []",
            "autocmd User DenopsProcessStarted call add(g:__test_denops_events, 'DenopsProcessStarted')",
            "autocmd User DenopsReady call add(g:__test_denops_events, 'DenopsReady')",
            // Test target
            "let g:denops_server_addr = ''",
            "runtime plugin/denops.vim",
            "let g:__test_denops_server_status_before_vimenter = denops#server#status()",
          ],
          fn: async ({ host, stderr }) => {
            const outputs: string[] = [];
            stderr.pipeTo(
              new WritableStream({ write: (s) => void outputs.push(s) }),
            ).catch(() => {});
            await t.step(
              "does not start a local server before VimEnter",
              async () => {
                const actual = await host.call(
                  "eval",
                  "g:__test_denops_server_status_before_vimenter",
                );
                assertEquals(actual, "stopped");
              },
            );

            await wait(
              () => host.call("eval", "denops#server#status() ==# 'running'"),
            );

            await t.step("starts a local server", async () => {
              assertEquals(
                await host.call("eval", "g:__test_denops_events"),
                ["DenopsProcessStarted", "DenopsReady"],
              );
            });

            await t.step("does not output messages", async () => {
              await delay(MESSAGE_DELAY);
              assertEquals(outputs, []);
            });
          },
        });
      });

      await t.step("if `g:denops_server_addr` is valid", async (t) => {
        await using server = await useSharedServer();

        await withHost({
          mode,
          postlude: [
            "let g:__test_denops_events = []",
            "autocmd User DenopsProcessStarted call add(g:__test_denops_events, 'DenopsProcessStarted')",
            "autocmd User DenopsReady call add(g:__test_denops_events, 'DenopsReady')",
            // Test target
            `let g:denops_server_addr = '${server.addr}'`,
            "runtime plugin/denops.vim",
          ],
          fn: async ({ host, stderr }) => {
            const outputs: string[] = [];
            stderr.pipeTo(
              new WritableStream({ write: (s) => void outputs.push(s) }),
            ).catch(() => {});
            await wait(
              () => host.call("eval", "denops#server#status() ==# 'running'"),
            );

            await t.step("connects to the shared server", async () => {
              assertEquals(
                await host.call("eval", "g:__test_denops_events"),
                ["DenopsReady"],
              );
            });

            await t.step("does not output messages", async () => {
              await delay(MESSAGE_DELAY);
              assertEquals(outputs, []);
            });
          },
        });
      });

      await t.step("if `g:denops_server_addr` is invalid", async (t) => {
        // NOTE: Get a non-existent address.
        const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
        const not_exists_address = `127.0.0.1:${listener.addr.port}`;
        listener.close();

        await withHost({
          mode,
          postlude: [
            "let g:__test_denops_events = []",
            "autocmd User DenopsProcessStarted call add(g:__test_denops_events, 'DenopsProcessStarted')",
            "autocmd User DenopsReady call add(g:__test_denops_events, 'DenopsReady')",
            // Test target
            `let g:denops_server_addr = '${not_exists_address}'`,
            "runtime plugin/denops.vim",
          ],
          fn: async ({ host, stderr }) => {
            const outputs: string[] = [];
            stderr.pipeTo(
              new WritableStream({ write: (s) => void outputs.push(s) }),
            ).catch(() => {});

            await wait(
              () => host.call("eval", "denops#server#status() ==# 'running'"),
            );

            await t.step("starts a local server", async () => {
              assertEquals(
                await host.call("eval", "g:__test_denops_events"),
                ["DenopsProcessStarted", "DenopsReady"],
              );
            });

            await t.step("outputs warning message after delayed", async () => {
              await delay(MESSAGE_DELAY);
              assertMatch(
                outputs.join(""),
                /Failed to connect channel `127\.0\.0\.1:[0-9]+`:/,
              );
            });
          },
        });
      });
    });

    await t.step("if sourced after VimEnter", async (t) => {
      await t.step("if `g:denops_server_addr` is not specified", async (t) => {
        await withHost({
          mode,
          fn: async ({ host, stderr }) => {
            const outputs: string[] = [];
            stderr.pipeTo(
              new WritableStream({ write: (s) => void outputs.push(s) }),
            ).catch(() => {});
            await host.call("execute", [
              "let g:__test_denops_events = []",
              "autocmd User DenopsProcessStarted call add(g:__test_denops_events, 'DenopsProcessStarted')",
              "autocmd User DenopsReady call add(g:__test_denops_events, 'DenopsReady')",
            ], "");
            await wait(() => host.call("eval", "!has('vim_starting')"));

            // Test target
            await host.call("execute", [
              "runtime plugin/denops.vim",
            ], "");

            await wait(
              () => host.call("eval", "denops#server#status() ==# 'running'"),
            );

            await t.step("starts a local server", async () => {
              assertEquals(
                await host.call("eval", "g:__test_denops_events"),
                ["DenopsProcessStarted", "DenopsReady"],
              );
            });

            await t.step("does not output messages", async () => {
              await delay(MESSAGE_DELAY);
              assertEquals(outputs, []);
            });
          },
        });
      });

      await t.step("if `g:denops_server_addr` is empty", async (t) => {
        await withHost({
          mode,
          fn: async ({ host, stderr }) => {
            const outputs: string[] = [];
            stderr.pipeTo(
              new WritableStream({ write: (s) => void outputs.push(s) }),
            ).catch(() => {});
            await host.call("execute", [
              "let g:__test_denops_events = []",
              "autocmd User DenopsProcessStarted call add(g:__test_denops_events, 'DenopsProcessStarted')",
              "autocmd User DenopsReady call add(g:__test_denops_events, 'DenopsReady')",
            ], "");
            await wait(() => host.call("eval", "!has('vim_starting')"));

            // Test target
            await host.call("execute", [
              "let g:denops_server_addr = ''",
              "runtime plugin/denops.vim",
            ], "");

            await wait(
              () => host.call("eval", "denops#server#status() ==# 'running'"),
            );

            await t.step("starts a local server", async () => {
              assertEquals(
                await host.call("eval", "g:__test_denops_events"),
                ["DenopsProcessStarted", "DenopsReady"],
              );
            });

            await t.step("does not output messages", async () => {
              await delay(MESSAGE_DELAY);
              assertEquals(outputs, []);
            });
          },
        });
      });

      await t.step("if `g:denops_server_addr` is valid", async (t) => {
        await using server = await useSharedServer();

        await withHost({
          mode,
          fn: async ({ host, stderr }) => {
            const outputs: string[] = [];
            stderr.pipeTo(
              new WritableStream({ write: (s) => void outputs.push(s) }),
            ).catch(() => {});
            await host.call("execute", [
              "let g:__test_denops_events = []",
              "autocmd User DenopsProcessStarted call add(g:__test_denops_events, 'DenopsProcessStarted')",
              "autocmd User DenopsReady call add(g:__test_denops_events, 'DenopsReady')",
            ], "");
            await wait(() => host.call("eval", "!has('vim_starting')"));

            // Test target
            await host.call("execute", [
              `let g:denops_server_addr = '${server.addr}'`,
              "runtime plugin/denops.vim",
            ], "");

            await wait(
              () => host.call("eval", "denops#server#status() ==# 'running'"),
            );

            await t.step("connects to the shared server", async () => {
              assertEquals(
                await host.call("eval", "g:__test_denops_events"),
                ["DenopsReady"],
              );
            });

            await t.step("does not output messages", async () => {
              await delay(MESSAGE_DELAY);
              assertEquals(outputs, []);
            });
          },
        });
      });

      await t.step("if `g:denops_server_addr` is invalid", async (t) => {
        // NOTE: Get a non-existent address.
        const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
        const not_exists_address = `127.0.0.1:${listener.addr.port}`;
        listener.close();

        await withHost({
          mode,
          fn: async ({ host, stderr }) => {
            const outputs: string[] = [];
            stderr.pipeTo(
              new WritableStream({ write: (s) => void outputs.push(s) }),
            ).catch(() => {});
            await host.call("execute", [
              "let g:__test_denops_events = []",
              "autocmd User DenopsProcessStarted call add(g:__test_denops_events, 'DenopsProcessStarted')",
              "autocmd User DenopsReady call add(g:__test_denops_events, 'DenopsReady')",
            ], "");
            await wait(() => host.call("eval", "!has('vim_starting')"));

            // Test target
            await host.call("execute", [
              `let g:denops_server_addr = '${not_exists_address}'`,
              "runtime plugin/denops.vim",
            ], "");

            await wait(
              () => host.call("eval", "denops#server#status() ==# 'running'"),
            );

            await t.step("starts a local server", async () => {
              assertEquals(
                await host.call("eval", "g:__test_denops_events"),
                ["DenopsProcessStarted", "DenopsReady"],
              );
            });

            await t.step("outputs warning message after delayed", async () => {
              await delay(MESSAGE_DELAY);
              assertMatch(
                outputs.join(""),
                /Failed to connect channel `127\.0\.0\.1:[0-9]+`:/,
              );
            });
          },
        });
      });
    });
  });
}
