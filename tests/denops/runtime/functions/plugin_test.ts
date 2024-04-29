import {
  assertArrayIncludes,
  assertEquals,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@0.225.2";
import { delay } from "jsr:@std/async@^0.224.0/delay";
import { join } from "jsr:@std/path@0.225.0/join";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";
import { promiseState } from "jsr:@lambdalisue/async@2.1.1";

const MESSAGE_DELAY = 200;

const scriptValid = resolve("dummy_valid_plugin.ts");
const scriptInvalid = resolve("dummy_invalid_plugin.ts");
const scriptValidDispose = resolve("dummy_valid_dispose_plugin.ts");
const scriptInvalidDispose = resolve("dummy_invalid_dispose_plugin.ts");
const runtimepathPlugin = resolve("dummy_plugins");

testHost({
  mode: "all",
  postlude: [
    "runtime plugin/denops.vim",
  ],
  fn: async ({ host, t, stderr }) => {
    let outputs: string[] = [];
    stderr.pipeTo(
      new WritableStream({ write: (s) => void outputs.push(s) }),
    ).catch(() => {});
    await wait(() => host.call("eval", "denops#server#status() ==# 'running'"));
    await host.call("execute", [
      "let g:__test_denops_events = []",
      "autocmd User DenopsPlugin* call add(g:__test_denops_events, expand('<amatch>'))",
    ], "");

    await t.step("denops#plugin#load()", async (t) => {
      await t.step("if the plugin is valid", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummy', '${scriptValid}')`,
        ], "");

        await t.step("loads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummy")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummy",
            "DenopsPluginPost:dummy",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      });

      await t.step("if the plugin entrypoint throws", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyInvalid', '${scriptInvalid}')`,
        ], "");

        await t.step("fails loading a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginFail:dummyInvalid")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummyInvalid",
            "DenopsPluginFail:dummyInvalid",
          ]);
        });

        await t.step("outputs an error message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /Failed to load plugin 'dummyInvalid': Error: This is dummy error/,
          );
        });
      });

      // NOTE: Depends on 'dummy' which was already loaded in the test above.
      await t.step("if the plugin is already loaded", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummy', '${scriptValid}')`,
        ], "");

        await t.step("does not load a denops plugin", async () => {
          const actual = wait(
            () => host.call("eval", "len(g:__test_denops_events)"),
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("does not fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), []);
        });

        await t.step("does not output messages", async () => {
          await delay(MESSAGE_DELAY);
          assertEquals(outputs, []);
        });
      });

      await t.step(
        "if the plugin is the same script with a different name",
        async (t) => {
          outputs = [];
          await host.call("execute", [
            "let g:__test_denops_events = []",
            `call denops#plugin#load('dummyOther', '${scriptValid}')`,
          ], "");

          await t.step("loads a denops plugin", async () => {
            await wait(async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .includes("DenopsPluginPost:dummyOther")
            );
          });

          await t.step("fires DenopsPlugin* events", async () => {
            assertEquals(await host.call("eval", "g:__test_denops_events"), [
              "DenopsPluginPre:dummyOther",
              "DenopsPluginPost:dummyOther",
            ]);
          });

          await t.step("calls the plugin entrypoint", () => {
            assertMatch(outputs.join(""), /Hello, Denops!/);
          });
        },
      );
    });

    await t.step("denops#plugin#unload()", async (t) => {
      await t.step("if the plugin is already loaded", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyUnload', '${scriptValidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnload")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#unload('dummyUnload')",
        ], "");

        await t.step("unloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginUnloadPost:dummyUnload")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyUnload",
            "DenopsPluginUnloadPost:dummyUnload",
          ]);
        });

        await t.step("calls the plugin dispose method", () => {
          assertMatch(outputs.join(""), /Goodbye, Denops!/);
        });
      });

      await t.step("if the plugin dispose method throws", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyUnloadInvalid', '${scriptInvalidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnloadInvalid")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#unload('dummyUnloadInvalid')",
        ], "");

        await t.step("unloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginUnloadFail:dummyUnloadInvalid")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyUnloadInvalid",
            "DenopsPluginUnloadFail:dummyUnloadInvalid",
          ]);
        });

        await t.step("outputs an error message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /Failed to unload plugin 'dummyUnloadInvalid': Error: This is dummy error in async dispose/,
          );
        });
      });

      await t.step("if the plugin is not yet loaded", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#unload('notexistsplugin')",
        ], "");

        await t.step("does not unload a denops plugin", async () => {
          const actual = wait(
            () => host.call("eval", "len(g:__test_denops_events)"),
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("does not fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), []);
        });

        await t.step("does not output messages", async () => {
          await delay(MESSAGE_DELAY);
          assertEquals(outputs, []);
        });
      });

      // NOTE: Depends on 'dummyUnload' which was already unloaded in the test above.
      await t.step("if the plugin is already unloaded", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#unload('dummyUnload')",
        ], "");

        await t.step("does not unload a denops plugin", async () => {
          const actual = wait(
            () => host.call("eval", "len(g:__test_denops_events)"),
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("does not fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), []);
        });

        await t.step("does not output messages", async () => {
          await delay(MESSAGE_DELAY);
          assertEquals(outputs, []);
        });
      });
    });

    await t.step("denops#plugin#reload()", async (t) => {
      // NOTE: Depends on 'dummy' which was already loaded in the test above.
      await t.step("if the plugin is already loaded", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#reload('dummy')",
        ], "");

        await t.step("reloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummy")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummy",
            "DenopsPluginUnloadPost:dummy",
            "DenopsPluginPre:dummy",
            "DenopsPluginPost:dummy",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      });

      await t.step("if the plugin dispose method throws", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyReloadInvalid', '${scriptInvalidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadInvalid")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#reload('dummyReloadInvalid')",
        ], "");

        await t.step("reloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyReloadInvalid")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyReloadInvalid",
            "DenopsPluginUnloadFail:dummyReloadInvalid",
            "DenopsPluginPre:dummyReloadInvalid",
            "DenopsPluginPost:dummyReloadInvalid",
          ]);
        });

        await t.step("outputs an error message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /Failed to unload plugin 'dummyReloadInvalid': Error: This is dummy error in async dispose/,
          );
        });
      });

      await t.step("if the plugin is not yet loaded", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#reload('notexistsplugin')",
        ], "");

        await t.step("does not reload a denops plugin", async () => {
          const actual = wait(
            () => host.call("eval", "len(g:__test_denops_events)"),
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("does not fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), []);
        });

        await t.step("does not output messages", async () => {
          await delay(MESSAGE_DELAY);
          assertEquals(outputs, []);
        });
      });

      // NOTE: Depends on 'dummyUnload' which was already unloaded in the test above.
      await t.step("if the plugin is already unloaded", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#reload('dummyUnload')",
        ], "");

        await t.step("does not reload a denops plugin", async () => {
          const actual = wait(
            () => host.call("eval", "len(g:__test_denops_events)"),
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("does not fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), []);
        });

        await t.step("does not output messages", async () => {
          await delay(MESSAGE_DELAY);
          assertEquals(outputs, []);
        });
      });
    });

    await t.step("denops#plugin#is_loaded()", async (t) => {
      // NOTE: Depends on 'dummy' which was already loaded in the test above.
      await t.step("returns 1 if the plugin `name` is loaded", async () => {
        const actual = await host.call("denops#plugin#is_loaded", "dummy");
        assertEquals(actual, 1);
      });

      await t.step("returns 0 if the plugin `name` is not exists", async () => {
        const actual = await host.call(
          "denops#plugin#is_loaded",
          "notexistsplugin",
        );
        assertEquals(actual, 0);
      });
    });

    await t.step("denops#plugin#discover()", async (t) => {
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `set runtimepath+=${await host.call("fnameescape", runtimepathPlugin)}`,
        `call denops#plugin#discover()`,
      ], "");

      await t.step("loads denops plugins", async () => {
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => /^DenopsPlugin(?:Post|Fail):/.test(ev)).length >= 2
        );
      });

      await t.step("fires DenopsPlugin* events", async () => {
        assertArrayIncludes(
          await host.call("eval", "g:__test_denops_events") as string[],
          [
            "DenopsPluginPre:dummy_valid",
            "DenopsPluginPost:dummy_valid",
            "DenopsPluginPre:dummy_invalid",
            "DenopsPluginFail:dummy_invalid",
          ],
        );
      });

      await t.step("does not load plugins name start with '@'", async () => {
        const events =
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => ev.includes("@dummy_namespace"));
        assertEquals(events, []);
      });

      await t.step("calls the plugin entrypoint", () => {
        assertMatch(outputs.join(""), /Hello, Denops!/);
      });

      await t.step("outputs an error message after delayed", async () => {
        await delay(MESSAGE_DELAY);
        assertMatch(
          outputs.join(""),
          /Failed to load plugin 'dummy_invalid': Error: This is dummy error/,
        );
      });
    });

    // NOTE: Depends on 'dummy' which was already loaded in the test above.
    await t.step("denops#plugin#check_type()", async (t) => {
      await t.step("if no arguments is specified", async (t) => {
        outputs = [];
        await host.call("execute", [
          // NOTE:
          // Call `denops#plugin#is_loaded()` and add an entry to the internal list.
          // This will result in a plugin entry whose script is empty.
          "call denops#plugin#is_loaded('notexistsplugin')",
        ], "");
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type()`,
        ], "");

        await t.step("outputs an info message after delayed", async () => {
          await wait(() => outputs.join("").includes("Type check"));
          assertMatch(outputs.join(""), /Type check succeeded/);
        });
      });

      await t.step("if the script name is specified", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type('dummy')`,
        ], "");

        await t.step("outputs an info message after delayed", async () => {
          await wait(() => outputs.join("").includes("Type check"));
          assertMatch(outputs.join(""), /Type check succeeded/);
        });
      });

      await t.step("if a non-existent script name is specified", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type('notexistsplugin')`,
        ], "");

        await t.step("outputs an error message after delayed", async () => {
          await wait(() => outputs.join("").includes("Type check"));
          assertMatch(outputs.join(""), /Type check failed:/);
        });
      });
    });

    await t.step("denops#plugin#wait_async()", async (t) => {
      await t.step("if the plugin is valid", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call timer_start(1000, { -> denops#plugin#load('dummyWaitAsync', '${scriptValid}') })`,
        ], "");

        const resultPromise = host.call("execute", [
          "call denops#plugin#wait_async('dummyWaitAsync', { -> add(g:__test_denops_events, 'wait_async callback called: dummyWaitAsync') })",
        ], "");

        await t.step("returns immediately", async () => {
          await delay(100); // host.call delay
          assertEquals(await promiseState(resultPromise), "fulfilled");
          await resultPromise;
        });

        await t.step("does not call the callback immediately", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), []);
        });

        await t.step(
          "calls the callback when the plugin is loaded",
          async () => {
            await wait(async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .includes("DenopsPluginPost:dummyWaitAsync")
            );
            assertArrayIncludes(
              await host.call("eval", "g:__test_denops_events") as string[],
              ["wait_async callback called: dummyWaitAsync"],
            );
          },
        );
      });

      // NOTE: Depends on 'dummyWaitAsync' which was already loaded in the test above.
      await t.step("if the plugin is already loaded", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
        ], "");

        const resultPromise = host.call("execute", [
          "call denops#plugin#wait_async('dummyWaitAsync', { -> add(g:__test_denops_events, 'wait_async callback called: dummyWaitAsync') })",
        ], "");

        await t.step("returns immediately", async () => {
          await delay(100); // host.call delay
          assertEquals(await promiseState(resultPromise), "fulfilled");
          await resultPromise;
        });

        await t.step("calls the callback immediately", async () => {
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["wait_async callback called: dummyWaitAsync"],
          );
        });
      });

      await t.step("if the plugin entrypoint throws", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call timer_start(1000, { -> denops#plugin#load('dummyWaitAsyncInvalid', '${scriptInvalid}') })`,
        ], "");

        const resultPromise = host.call("execute", [
          "call denops#plugin#wait_async('dummyWaitAsyncInvalid', { -> add(g:__test_denops_events, 'wait_async callback called: dummyWaitAsync') })",
        ], "");

        await t.step("returns immediately", async () => {
          await delay(100); // host.call delay
          assertEquals(await promiseState(resultPromise), "fulfilled");
          await resultPromise;
        });

        await t.step(
          "does not call the callback when the plugin is failed",
          async () => {
            await wait(async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .includes("DenopsPluginFail:dummyWaitAsyncInvalid")
            );
            const events =
              (await host.call("eval", "g:__test_denops_events") as string[])
                .filter((ev) => !/^DenopsPlugin/.test(ev));
            assertEquals(events, []);
          },
        );
      });
    });

    // NOTE: This test stops the denops server.
    // FIXME: This test will run infinitely on Mac.
    await t.step({
      name: "denops#plugin#wait()",
      ignore: Deno.build.os === "darwin",
      fn: async (t) => {
        await t.step("if the plugin is valid", async (t) => {
          await host.call("execute", [
            "let g:__test_denops_events = []",
            `call denops#plugin#load('dummyWait', '${scriptValid}')`,
          ], "");

          const resultPromise = host.call("denops#plugin#wait", "dummyWait");

          await t.step("waits the plugin is loaded", async () => {
            assertEquals(await promiseState(resultPromise), "pending");
          });

          await t.step("returns 0", async () => {
            assertEquals(await resultPromise, 0);
          });

          await t.step(
            "the plugin is already loaded after returns",
            async () => {
              assertEquals(await host.call("eval", "g:__test_denops_events"), [
                "DenopsPluginPre:dummyWait",
                "DenopsPluginPost:dummyWait",
              ]);
            },
          );
        });

        // NOTE: Depends on 'dummyWait' which was already loaded in the test above.
        await t.step("if the plugin is already loaded", async (t) => {
          const resultPromise = host.call("denops#plugin#wait", "dummyWait");

          await t.step("returns immediately", async () => {
            await delay(100); // host.call delay
            assertEquals(await promiseState(resultPromise), "fulfilled");
          });

          await t.step("returns 0", async () => {
            assertEquals(await resultPromise, 0);
          });
        });

        await t.step("if the plugin entrypoint throws", async (t) => {
          await host.call("execute", [
            "let g:__test_denops_events = []",
            `call denops#plugin#load('dummyWaitInvalid', '${scriptInvalid}')`,
          ], "");

          const resultPromise = host.call(
            "denops#plugin#wait",
            "dummyWaitInvalid",
          );

          await t.step("waits the plugin is failed", async () => {
            assertEquals(await promiseState(resultPromise), "pending");
          });

          await t.step("returns -3", async () => {
            assertEquals(await resultPromise, -3);
          });

          await t.step(
            "the plugin is already failed after returns",
            async () => {
              assertEquals(await host.call("eval", "g:__test_denops_events"), [
                "DenopsPluginPre:dummyWaitInvalid",
                "DenopsPluginFail:dummyWaitInvalid",
              ]);
            },
          );
        });

        await t.step("if it times out", async (t) => {
          await t.step("if no `silent` is specified", async (t) => {
            outputs = [];

            await t.step("returns -1", async () => {
              const actual = await host.call(
                "denops#plugin#wait",
                "notexistsplugin",
                { timeout: 100 },
              );
              assertEquals(actual, -1);
            });

            await t.step("outputs an error message", async () => {
              await delay(MESSAGE_DELAY);
              assertMatch(
                outputs.join(""),
                /Failed to wait for "notexistsplugin" to start\. It took more than 100 milliseconds and timed out\./,
              );
            });
          });

          await t.step("if `silent=1`", async (t) => {
            outputs = [];

            await t.step("returns -1", async () => {
              const actual = await host.call(
                "denops#plugin#wait",
                "notexistsplugin",
                { timeout: 100, silent: 1 },
              );
              assertEquals(actual, -1);
            });

            await t.step("does not output error messages", async () => {
              await delay(MESSAGE_DELAY);
              assertEquals(outputs, []);
            });
          });
        });

        // NOTE: This test stops the denops server.
        await t.step("if the denops server is stopped", async (t) => {
          await host.call("denops#server#stop");
          await wait(
            () => host.call("eval", "denops#server#status() ==# 'stopped'"),
          );

          await t.step("if no `silent` is specified", async (t) => {
            outputs = [];

            await t.step("returns -2", async () => {
              const actual = await host.call("denops#plugin#wait", "dummy");
              assertEquals(actual, -2);
            });

            await t.step("outputs an error message", async () => {
              await delay(MESSAGE_DELAY);
              assertMatch(
                outputs.join(""),
                /Failed to wait for "dummy" to start\. Denops server itself is not started\./,
              );
            });
          });

          await t.step("if `silent=1`", async (t) => {
            outputs = [];

            await t.step("returns -2", async () => {
              const actual = await host.call("denops#plugin#wait", "dummy", {
                silent: 1,
              });
              assertEquals(actual, -2);
            });

            await t.step("does not output error messages", async () => {
              await delay(MESSAGE_DELAY);
              assertEquals(outputs, []);
            });
          });
        });
      },
    });
  },
});

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../../testdata/${path}`);
}
