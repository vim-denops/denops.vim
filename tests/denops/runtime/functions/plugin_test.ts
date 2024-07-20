import {
  assertArrayIncludes,
  assertEquals,
  assertGreater,
  assertLess,
  assertMatch,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@1.0.1";
import { delay } from "jsr:@std/async@^0.224.0";
import { join } from "jsr:@std/path@1.0.2/join";
import { AsyncDisposableStack } from "jsr:@nick/dispose@1.1.0/async-disposable-stack";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200; // msc

const scriptValid = resolve("dummy_valid_plugin.ts");
const scriptInvalid = resolve("dummy_invalid_plugin.ts");
const scriptValidDispose = resolve("dummy_valid_dispose_plugin.ts");
const scriptInvalidDispose = resolve("dummy_invalid_dispose_plugin.ts");
const scriptValidWait = resolve("dummy_valid_wait_plugin.ts");
const scriptInvalidWait = resolve("dummy_invalid_wait_plugin.ts");
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
      await t.step("if the plugin name is invalid", async (t) => {
        await t.step("throws an error", async () => {
          // NOTE: '.' is not allowed in plugin name.
          await assertRejects(
            () => host.call("denops#plugin#load", "dummy.invalid", scriptValid),
            Error,
            "Invalid plugin name: dummy.invalid",
          );
        });
      });

      await t.step("if the plugin is not yet loaded", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadNotLoaded', '${scriptValid}')`,
        ], "");

        await t.step("loads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyLoadNotLoaded")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummyLoadNotLoaded",
            "DenopsPluginPost:dummyLoadNotLoaded",
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
          `call denops#plugin#load('dummyLoadInvalid', '${scriptInvalid}')`,
        ], "");

        await t.step("fails loading a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginFail:dummyLoadInvalid")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummyLoadInvalid",
            "DenopsPluginFail:dummyLoadInvalid",
          ]);
        });

        await t.step("outputs an error message after delayed", async () => {
          await delay(MESSAGE_DELAY);
          assertMatch(
            outputs.join(""),
            /Failed to load plugin 'dummyLoadInvalid': Error: This is dummy error/,
          );
        });
      });

      await t.step(
        "if the plugin is the same script with a different name",
        async (t) => {
          outputs = [];
          await host.call("execute", [
            "let g:__test_denops_events = []",
            `call denops#plugin#load('dummyLoadOther', '${scriptValid}')`,
          ], "");

          await t.step("loads a denops plugin", async () => {
            await wait(async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .includes("DenopsPluginPost:dummyLoadOther")
            );
          });

          await t.step("fires DenopsPlugin* events", async () => {
            assertEquals(await host.call("eval", "g:__test_denops_events"), [
              "DenopsPluginPre:dummyLoadOther",
              "DenopsPluginPost:dummyLoadOther",
            ]);
          });

          await t.step("calls the plugin entrypoint", () => {
            assertMatch(outputs.join(""), /Hello, Denops!/);
          });
        },
      );

      await t.step("if the plugin is loading", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadLoading', '${scriptValid}')`,
          `call denops#plugin#load('dummyLoadLoading', '${scriptValid}')`,
        ], "");

        await t.step("loads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyLoadLoading")
          );
        });

        await t.step("does not load a denops plugin twice", async () => {
          const actual = wait(
            async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .filter((ev) => ev.startsWith("DenopsPluginPost:"))
                .length >= 2,
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummyLoadLoading",
            "DenopsPluginPost:dummyLoadLoading",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      });

      await t.step("if the plugin is loaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadLoaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadLoaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadLoaded', '${scriptValid}')`,
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

      await t.step("if the plugin is unloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadUnloading', '${scriptValidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadUnloading")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#unload('dummyLoadUnloading')`,
          `call denops#plugin#load('dummyLoadUnloading', '${scriptValid}')`,
        ], "");

        await t.step("unloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginUnloadPost:dummyLoadUnloading")
          );
        });

        await t.step("does not load a denops plugin", async () => {
          const actual = wait(
            async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .includes("DenopsPluginPost:dummyLoadUnloading"),
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyLoadUnloading",
            "DenopsPluginUnloadPost:dummyLoadUnloading",
          ]);
        });

        await t.step("calls the plugin dispose method", () => {
          assertMatch(outputs.join(""), /Goodbye, Denops!/);
        });
      });

      await t.step("if the plugin is unloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadUnloaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadUnloaded")
        );
        // Unload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#unload('dummyLoadUnloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyLoadUnloaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadUnloaded', '${scriptValid}')`,
        ], "");

        await t.step("loads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyLoadUnloaded")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummyLoadUnloaded",
            "DenopsPluginPost:dummyLoadUnloaded",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      });

      await t.step("if the plugin is reloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadReloading', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadReloading")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyLoadReloading')`,
          `call denops#plugin#load('dummyLoadReloading', '${scriptValid}')`,
        ], "");

        await t.step("reloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyLoadReloading")
          );
        });

        await t.step("does not load a denops plugin twice", async () => {
          const actual = wait(
            async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .filter((ev) => ev.startsWith("DenopsPluginPost:"))
                .length >= 2,
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyLoadReloading",
            "DenopsPluginUnloadPost:dummyLoadReloading",
            "DenopsPluginPre:dummyLoadReloading",
            "DenopsPluginPost:dummyLoadReloading",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      });

      await t.step("if the plugin is reloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadReloaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadReloaded")
        );
        // Reload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyLoadReloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyLoadReloaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyLoadReloaded', '${scriptValid}')`,
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
    });

    await t.step("denops#plugin#unload()", async (t) => {
      await t.step("if the plugin name is invalid", async (t) => {
        await t.step("throws an error", async () => {
          // NOTE: '.' is not allowed in plugin name.
          await assertRejects(
            () => host.call("denops#plugin#unload", "dummy.invalid"),
            Error,
            "Invalid plugin name: dummy.invalid",
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

      await t.step("if the plugin is loading", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyUnloadLoading', '${scriptValidDispose}')`,
          "call denops#plugin#unload('dummyUnloadLoading')",
        ], "");

        await t.step("unloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginUnloadPost:dummyUnloadLoading")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummyUnloadLoading",
            "DenopsPluginPost:dummyUnloadLoading",
            "DenopsPluginUnloadPre:dummyUnloadLoading",
            "DenopsPluginUnloadPost:dummyUnloadLoading",
          ]);
        });

        await t.step("calls the plugin dispose method", () => {
          assertMatch(outputs.join(""), /Goodbye, Denops!/);
        });
      });

      await t.step("if the plugin is loaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyUnloadLoaded', '${scriptValidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnloadLoaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#unload('dummyUnloadLoaded')",
        ], "");

        await t.step("unloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginUnloadPost:dummyUnloadLoaded")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyUnloadLoaded",
            "DenopsPluginUnloadPost:dummyUnloadLoaded",
          ]);
        });

        await t.step("calls the plugin dispose method", () => {
          assertMatch(outputs.join(""), /Goodbye, Denops!/);
        });
      });

      await t.step("if the plugin is unloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyUnloadUnloading', '${scriptValidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnloadUnloading")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#unload('dummyUnloadUnloading')`,
          "call denops#plugin#unload('dummyUnloadUnloading')",
        ], "");

        await t.step("unloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginUnloadPost:dummyUnloadUnloading")
          );
        });

        await t.step("does not unload a denops plugin twice", async () => {
          const actual = wait(
            async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .filter((ev) => ev.startsWith("DenopsPluginUnloadPost:"))
                .length >= 2,
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyUnloadUnloading",
            "DenopsPluginUnloadPost:dummyUnloadUnloading",
          ]);
        });

        await t.step("calls the plugin dispose method", () => {
          assertMatch(outputs.join(""), /Goodbye, Denops!/);
        });
      });

      await t.step("if the plugin is unloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyUnloadUnloaded', '${scriptValidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnloadUnloaded")
        );
        // Unload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#unload('dummyUnloadUnloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyUnloadUnloaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#unload('dummyUnloadUnloaded')",
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

      await t.step("if the plugin is reloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyUnloadReloading', '${scriptValidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnloadReloading")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyUnloadReloading')`,
          "call denops#plugin#unload('dummyUnloadReloading')",
        ], "");

        await t.step("reloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyUnloadReloading")
          );
        });

        await t.step("does not unload a denops plugin twice", async () => {
          const actual = wait(
            async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .filter((ev) => ev.startsWith("DenopsPluginUnloadPost:"))
                .length >= 2,
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyUnloadReloading",
            "DenopsPluginUnloadPost:dummyUnloadReloading",
            "DenopsPluginPre:dummyUnloadReloading",
            "DenopsPluginPost:dummyUnloadReloading",
          ]);
        });

        await t.step("calls the plugin dispose method", () => {
          assertMatch(outputs.join(""), /Goodbye, Denops!/);
        });
      });

      await t.step("if the plugin is reloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyUnloadReloaded', '${scriptValidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnloadReloaded")
        );
        // Reload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyUnloadReloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyUnloadReloaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#unload('dummyUnloadReloaded')",
        ], "");

        await t.step("unloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginUnloadPost:dummyUnloadReloaded")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyUnloadReloaded",
            "DenopsPluginUnloadPost:dummyUnloadReloaded",
          ]);
        });

        await t.step("calls the plugin dispose method", () => {
          assertMatch(outputs.join(""), /Goodbye, Denops!/);
        });
      });
    });

    await t.step("denops#plugin#reload()", async (t) => {
      await t.step("if the plugin name is invalid", async (t) => {
        await t.step("throws an error", async () => {
          // NOTE: '.' is not allowed in plugin name.
          await assertRejects(
            () => host.call("denops#plugin#reload", "dummy.invalid"),
            Error,
            "Invalid plugin name: dummy.invalid",
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

      await t.step("if the plugin is loading", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyReloadLoading', '${scriptValid}')`,
          "call denops#plugin#reload('dummyReloadLoading')",
        ], "");

        await t.step("reloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("DenopsPluginPost:"))
              .length >= 2
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginPre:dummyReloadLoading",
            "DenopsPluginPost:dummyReloadLoading",
            "DenopsPluginUnloadPre:dummyReloadLoading",
            "DenopsPluginUnloadPost:dummyReloadLoading",
            "DenopsPluginPre:dummyReloadLoading",
            "DenopsPluginPost:dummyReloadLoading",
          ]);
        });

        await t.step("calls the plugin entrypoint twice", () => {
          assertMatch(outputs.join(""), /Hello, Denops!.*Hello, Denops!/s);
        });
      });

      await t.step("if the plugin is loaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyReloadLoaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadLoaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#reload('dummyReloadLoaded')",
        ], "");

        await t.step("reloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyReloadLoaded")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyReloadLoaded",
            "DenopsPluginUnloadPost:dummyReloadLoaded",
            "DenopsPluginPre:dummyReloadLoaded",
            "DenopsPluginPost:dummyReloadLoaded",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      });

      await t.step("if the plugin is unloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyReloadUnloading', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadUnloading")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#unload('dummyReloadUnloading')`,
          "call denops#plugin#reload('dummyReloadUnload')",
        ], "");

        await t.step("does not reload a denops plugin", async () => {
          const actual = wait(
            async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .includes("DenopsPluginPost:dummyReloadUnloading"),
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyReloadUnloading",
            "DenopsPluginUnloadPost:dummyReloadUnloading",
          ]);
        });

        await t.step("does not output messages", async () => {
          await delay(MESSAGE_DELAY);
          assertEquals(outputs, []);
        });
      });

      await t.step("if the plugin is unloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyReloadUnloaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadUnloaded")
        );
        // Unload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#unload('dummyReloadUnloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyReloadUnloaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#reload('dummyReloadUnload')",
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

      await t.step("if the plugin is reloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyReloadReloading', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadReloading")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyReloadReloading')`,
          "call denops#plugin#reload('dummyReloadReloading')",
        ], "");

        await t.step("reloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyReloadReloading")
          );
        });

        await t.step("does not reload a denops plugin twice", async () => {
          const actual = wait(
            async () =>
              (await host.call("eval", "g:__test_denops_events") as string[])
                .filter((ev) => ev.startsWith("DenopsPluginPost:"))
                .length >= 2,
            { timeout: 1000, interval: 100 },
          );
          await assertRejects(() => actual, Error, "Timeout");
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyReloadReloading",
            "DenopsPluginUnloadPost:dummyReloadReloading",
            "DenopsPluginPre:dummyReloadReloading",
            "DenopsPluginPost:dummyReloadReloading",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      });

      await t.step("if the plugin is reloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyReloadReloaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadReloaded")
        );
        // Reload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyReloadReloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyReloadReloaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "call denops#plugin#reload('dummyReloadReloaded')",
        ], "");

        await t.step("reloads a denops plugin", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyReloadReloaded")
          );
        });

        await t.step("fires DenopsPlugin* events", async () => {
          assertEquals(await host.call("eval", "g:__test_denops_events"), [
            "DenopsPluginUnloadPre:dummyReloadReloaded",
            "DenopsPluginUnloadPost:dummyReloadReloaded",
            "DenopsPluginPre:dummyReloadReloaded",
            "DenopsPluginPost:dummyReloadReloaded",
          ]);
        });

        await t.step("calls the plugin entrypoint", () => {
          assertMatch(outputs.join(""), /Hello, Denops!/);
        });
      });
    });

    await t.step("denops#plugin#is_loaded()", async (t) => {
      await using stack = new AsyncDisposableStack();
      stack.defer(async () => {
        await host.call("execute", [
          "augroup __test_denops_is_loaded",
          "  autocmd!",
          "augroup END",
        ], "");
      });
      await host.call("execute", [
        "let g:__test_denops_is_loaded = {}",
        "augroup __test_denops_is_loaded",
        "  autocmd!",
        "  autocmd User DenopsPlugin* let g:__test_denops_is_loaded[expand('<amatch>')] = denops#plugin#is_loaded(expand('<amatch>')->matchstr(':\\zs.*'))",
        "augroup END",
      ], "");

      await t.step("if the plugin name is invalid", async (t) => {
        await t.step("throws an error", async () => {
          // NOTE: '.' is not allowed in plugin name.
          await assertRejects(
            () => host.call("denops#plugin#is_loaded", "dummy.invalid"),
            Error,
            "Invalid plugin name: dummy.invalid",
          );
        });
      });

      await t.step("if the plugin is not yet loaded", async (t) => {
        await t.step("returns 0", async () => {
          const actual = await host.call(
            "denops#plugin#is_loaded",
            "notexistsplugin",
          );
          assertEquals(actual, 0);
        });
      });

      await t.step("if the plugin entrypoint throws", async (t) => {
        // Load plugin and wait failure.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "let g:__test_denops_is_loaded = {}",
          `call denops#plugin#load('dummyIsLoadedInvalid', '${scriptInvalid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginFail:dummyIsLoadedInvalid")
        );

        await t.step("returns 0 when DenopsPluginPre", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginPre:dummyIsLoadedInvalid']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 1 when DenopsPluginFail", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginFail:dummyIsLoadedInvalid']",
          );
          assertEquals(actual, 1);
        });

        await t.step("returns 1 after DenopsPluginFail", async () => {
          const actual = await host.call(
            "denops#plugin#is_loaded",
            "dummyIsLoadedInvalid",
          );
          assertEquals(actual, 1);
        });

        await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#load()
      });

      await t.step("if the plugin dispose method throws", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyIsLoadedInvalidDispose', '${scriptInvalidDispose}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyIsLoadedInvalidDispose")
        );
        // Unload plugin and wait failure.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "let g:__test_denops_is_loaded = {}",
          `call denops#plugin#unload('dummyIsLoadedInvalidDispose')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadFail:dummyIsLoadedInvalidDispose")
        );

        await t.step("returns 0 when DenopsPluginUnloadPre", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginUnloadPre:dummyIsLoadedInvalidDispose']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 when DenopsPluginUnloadFail", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginUnloadFail:dummyIsLoadedInvalidDispose']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 after DenopsPluginUnloadFail", async () => {
          const actual = await host.call(
            "denops#plugin#is_loaded",
            "dummyIsLoadedInvalidDispose",
          );
          assertEquals(actual, 0);
        });

        await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#unload()
      });

      await t.step("if the plugin is loading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "let g:__test_denops_is_loaded = {}",
          `call denops#plugin#load('dummyIsLoadedLoading', '${scriptValid}')`,
          "let g:__test_denops_plugin_is_loaded_after_load = denops#plugin#is_loaded('dummyIsLoadedLoading')",
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyIsLoadedLoading")
        );

        await t.step("returns 0 immediately after `load()`", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_plugin_is_loaded_after_load",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 when DenopsPluginPre", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginPre:dummyIsLoadedLoading']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 1 when DenopsPluginPost", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginPost:dummyIsLoadedLoading']",
          );
          assertEquals(actual, 1);
        });

        await t.step("returns 1 after DenopsPluginPost", async () => {
          const actual = await host.call(
            "denops#plugin#is_loaded",
            "dummyIsLoadedLoading",
          );
          assertEquals(actual, 1);
        });
      });

      await t.step("if the plugin is unloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyIsLoadedUnloading', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyIsLoadedUnloading")
        );
        // Unload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "let g:__test_denops_is_loaded = {}",
          `call denops#plugin#unload('dummyIsLoadedUnloading')`,
          "let g:__test_denops_plugin_is_loaded_after_unload = denops#plugin#is_loaded('dummyIsLoadedUnloading')",
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyIsLoadedUnloading")
        );

        await t.step("returns 0 immediately after `unload()`", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_plugin_is_loaded_after_unload",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 when DenopsPluginUnloadPre", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginUnloadPre:dummyIsLoadedUnloading']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 when DenopsPluginUnloadPost", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginUnloadPost:dummyIsLoadedUnloading']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 after DenopsPluginUnloadPost", async () => {
          const actual = await host.call(
            "denops#plugin#is_loaded",
            "dummyIsLoadedUnloading",
          );
          assertEquals(actual, 0);
        });
      });

      await t.step("if the plugin is reloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyIsLoadedReloading', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyIsLoadedReloading")
        );
        // Reload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          "let g:__test_denops_is_loaded = {}",
          `call denops#plugin#reload('dummyIsLoadedReloading')`,
          "let g:__test_denops_plugin_is_loaded_after_reload = denops#plugin#is_loaded('dummyIsLoadedReloading')",
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyIsLoadedReloading")
        );

        await t.step("returns 0 immediately after `reaload()`", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_plugin_is_loaded_after_reload",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 when DenopsPluginUnloadPre", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginUnloadPre:dummyIsLoadedReloading']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 when DenopsPluginUnloadPost", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginUnloadPost:dummyIsLoadedReloading']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 0 when DenopsPluginPre", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginPre:dummyIsLoadedReloading']",
          );
          assertEquals(actual, 0);
        });

        await t.step("returns 1 when DenopsPluginPost", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_is_loaded['DenopsPluginPost:dummyIsLoadedReloading']",
          );
          assertEquals(actual, 1);
        });

        await t.step("returns 1 after DenopsPluginPost", async () => {
          const actual = await host.call(
            "denops#plugin#is_loaded",
            "dummyIsLoadedReloading",
          );
          assertEquals(actual, 1);
        });
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
        const loaded_events = [
          "DenopsPluginPost:",
          "DenopsPluginFail:",
        ];
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => loaded_events.some((name) => ev.startsWith(name)))
            .length >= 2
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

      await t.step("does not load invaid name plugins", async () => {
        const valid_names = [
          ":dummy_valid",
          ":dummy_invalid",
        ] as const;
        const actual =
          (await host.call("eval", "g:__test_denops_events") as string[])
            .filter((ev) => !valid_names.some((name) => ev.endsWith(name)));
        assertEquals(actual, []);
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

      await t.step("if the plugin name is invalid", async (t) => {
        await t.step("throws an error", async () => {
          // NOTE: '.' is not allowed in plugin name.
          await assertRejects(
            () => host.call("denops#plugin#check_type", "dummy.invalid"),
            Error,
            "Invalid plugin name: dummy.invalid",
          );
        });
      });

      await t.step("if the plugin is not yet loaded", async (t) => {
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

      await t.step("if the plugin is loaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyCheckTypeLoaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyCheckTypeLoaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type('dummyCheckTypeLoaded')`,
        ], "");

        await t.step("outputs an info message after delayed", async () => {
          await wait(() => outputs.join("").includes("Type check"));
          assertMatch(outputs.join(""), /Type check succeeded/);
        });
      });

      await t.step("if the plugin is unloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyCheckTypeUnloaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyCheckTypeUnloaded")
        );
        // Unload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#unload('dummyCheckTypeUnloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginUnloadPost:dummyCheckTypeUnloaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type('dummyCheckTypeUnloaded')`,
        ], "");

        await t.step("outputs an info message after delayed", async () => {
          await wait(() => outputs.join("").includes("Type check"));
          assertMatch(outputs.join(""), /Type check succeeded/);
        });
      });

      await t.step("if the plugin is reloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyCheckTypeReloaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyCheckTypeReloaded")
        );
        // Reload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyCheckTypeReloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyCheckTypeReloaded")
        );

        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type('dummyCheckTypeReloaded')`,
        ], "");

        await t.step("outputs an info message after delayed", async () => {
          await wait(() => outputs.join("").includes("Type check"));
          assertMatch(outputs.join(""), /Type check succeeded/);
        });
      });
    });

    await t.step("denops#plugin#wait_async()", async (t) => {
      await t.step("if the plugin name is invalid", async (t) => {
        await t.step("throws an error", async () => {
          // NOTE: '.' is not allowed in plugin name.
          await assertRejects(
            () =>
              host.call("execute", [
                "call denops#plugin#wait_async('dummy.invalid', { -> 0 })",
              ], ""),
            Error,
            "Invalid plugin name: dummy.invalid",
          );
        });
      });

      await t.step("if the plugin is load asynchronously", async (t) => {
        // Load plugin asynchronously.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call timer_start(1000, { -> denops#plugin#load('dummyWaitAsyncLoadAsync', '${scriptValid}') })`,
        ], "");

        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "call denops#plugin#wait_async('dummyWaitAsyncLoadAsync', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncLoadAsync') })",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("does not call `callback` immediately", async () => {
          const actual =
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
          assertEquals(actual, []);
        });

        await t.step("calls `callback` when the plugin is loaded", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyWaitAsyncLoadAsync")
          );
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["WaitAsyncCallbackCalled:dummyWaitAsyncLoadAsync"],
          );
        });
      });

      await t.step("if the plugin is loading", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitAsyncLoading', '${scriptValidWait}')`,
          "let g:__test_denops_wait_start = reltime()",
          "call denops#plugin#wait_async('dummyWaitAsyncLoading', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncLoading') })",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("does not call `callback` immediately", async () => {
          const actual =
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
          assertEquals(actual, []);
        });

        await t.step("calls `callback` when the plugin is loaded", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyWaitAsyncLoading")
          );
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["WaitAsyncCallbackCalled:dummyWaitAsyncLoading"],
          );
        });
      });

      await t.step("if the plugin is loaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          `call denops#plugin#load('dummyWaitAsyncLoaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitAsyncLoaded")
        );

        await host.call("execute", [
          "let g:__test_denops_events = []",
          "let g:__test_denops_wait_start = reltime()",
          "call denops#plugin#wait_async('dummyWaitAsyncLoaded', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncLoaded') })",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("calls `callback` immediately", async () => {
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["WaitAsyncCallbackCalled:dummyWaitAsyncLoaded"],
          );
        });
      });

      await t.step("if the plugin is reloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitAsyncReloading', '${scriptValidWait}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitAsyncReloading")
        );

        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyWaitAsyncReloading')`,
          "let g:__test_denops_wait_start = reltime()",
          "call denops#plugin#wait_async('dummyWaitAsyncReloading', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncReloading') })",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("does not call `callback` immediately", async () => {
          const actual =
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
          assertEquals(actual, []);
        });

        await t.step("calls `callback` when the plugin is loaded", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginPost:dummyWaitAsyncReloading")
          );
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["WaitAsyncCallbackCalled:dummyWaitAsyncReloading"],
          );
        });
      });

      await t.step("if the plugin is reloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitAsyncReloaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitAsyncReloaded")
        );
        // Reload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyWaitAsyncReloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitAsyncReloaded")
        );

        await host.call("execute", [
          "let g:__test_denops_events = []",
          "let g:__test_denops_wait_start = reltime()",
          "call denops#plugin#wait_async('dummyWaitAsyncReloaded', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncReloaded') })",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("calls `callback` immediately", async () => {
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["WaitAsyncCallbackCalled:dummyWaitAsyncReloaded"],
          );
        });
      });

      await t.step("if the plugin is loading and fails", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitAsyncLoadingAndFails', '${scriptInvalidWait}')`,
          "let g:__test_denops_wait_start = reltime()",
          "call denops#plugin#wait_async('dummyWaitAsyncLoadingAndFails', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncLoadingAndFails') })",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("does not call `callback`", async () => {
          await wait(async () =>
            (await host.call("eval", "g:__test_denops_events") as string[])
              .includes("DenopsPluginFail:dummyWaitAsyncLoadingAndFails")
          );
          const actual =
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
          assertEquals(actual, []);
        });

        await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#load()
      });

      await t.step("if the plugin is failed to load", async (t) => {
        // Load plugin and wait failure.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitFailed', '${scriptInvalid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginFail:dummyWaitFailed")
        );

        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "call denops#plugin#wait_async('dummyWaitAsyncFailed', { -> add(g:__test_denops_events, 'WaitAsyncCallbackCalled:dummyWaitAsyncFailed') })",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("does not call `callback`", async () => {
          const actual =
            (await host.call("eval", "g:__test_denops_events") as string[])
              .filter((ev) => ev.startsWith("WaitAsyncCallbackCalled:"));
          assertEquals(actual, []);
        });

        await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#load()
      });
    });

    // NOTE: This test stops the denops server.
    await t.step("denops#plugin#wait()", async (t) => {
      await t.step("if the plugin name is invalid", async (t) => {
        await t.step("throws an error", async () => {
          // NOTE: '.' is not allowed in plugin name.
          await assertRejects(
            () => host.call("denops#plugin#wait", "dummy.invalid"),
            Error,
            "Invalid plugin name: dummy.invalid",
          );
        });
      });

      await t.step("if the plugin is loading", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitLoading', '${scriptValidWait}')`,
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitLoading', {'timeout': 5000})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("waits the plugin is loaded", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertGreater(elapsed_sec, 1.0);
          assertLess(elapsed_sec, 5.0);
        });

        await t.step("returns 0", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, 0);
        });

        await t.step("the plugin is loaded after returns", async () => {
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["DenopsPluginPost:dummyWaitLoading"],
          );
        });
      });

      await t.step("if the plugin is loaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitLoaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitLoaded")
        );

        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitLoaded', {'timeout': 5000})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("returns 0", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, 0);
        });
      });

      await t.step("if the plugin is reloading", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitReloading', '${scriptValidWait}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitReloading")
        );

        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyWaitReloading')`,
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitReloading', {'timeout': 5000})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("waits the plugin is loaded", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertGreater(elapsed_sec, 1.0);
          assertLess(elapsed_sec, 5.0);
        });

        await t.step("returns 0", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, 0);
        });

        await t.step("the plugin is loaded after returns", async () => {
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["DenopsPluginPost:dummyWaitReloading"],
          );
        });
      });

      await t.step("if the plugin is reloaded", async (t) => {
        // Load plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitReloaded', '${scriptValid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitReloaded")
        );
        // Reload plugin and wait.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#reload('dummyWaitReloaded')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginPost:dummyWaitReloaded")
        );

        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitReloaded', {'timeout': 5000})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("returns 0", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, 0);
        });
      });

      await t.step("if the plugin is loading and fails", async (t) => {
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitLoadingAndFails', '${scriptInvalidWait}')`,
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitLoadingAndFails', {'timeout': 5000})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("waits the plugin is failed", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertGreater(elapsed_sec, 1.0);
          assertLess(elapsed_sec, 5.0);
        });

        await t.step("returns -3", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, -3);
        });

        await t.step("the plugin is failed after returns", async () => {
          assertArrayIncludes(
            await host.call("eval", "g:__test_denops_events") as string[],
            ["DenopsPluginFail:dummyWaitLoadingAndFails"],
          );
        });
      });

      await t.step("if the plugin is failed to load", async (t) => {
        // Load plugin and wait failure.
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#load('dummyWaitFailed', '${scriptInvalid}')`,
        ], "");
        await wait(async () =>
          (await host.call("eval", "g:__test_denops_events") as string[])
            .includes("DenopsPluginFail:dummyWaitFailed")
        );

        await host.call("execute", [
          "let g:__test_denops_wait_start = reltime()",
          "let g:__test_denops_wait_result = denops#plugin#wait('dummyWaitFailed', {'timeout': 5000})",
          "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
        ], "");

        await t.step("returns immediately", async () => {
          const elapsed_sec = await host.call(
            "eval",
            "g:__test_denops_wait_elapsed",
          ) as number;
          assertLess(elapsed_sec, 0.1);
        });

        await t.step("returns -3", async () => {
          const actual = await host.call(
            "eval",
            "g:__test_denops_wait_result",
          );
          assertEquals(actual, -3);
        });

        await delay(MESSAGE_DELAY); // Wait outputs of denops#plugin#load()
      });

      await t.step("if it times out", async (t) => {
        await t.step("if no `silent` is specified", async (t) => {
          outputs = [];
          await host.call("execute", [
            "let g:__test_denops_wait_start = reltime()",
            "let g:__test_denops_wait_result = denops#plugin#wait('notexistsplugin', {'timeout': 1000})",
            "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
          ], "");

          await t.step("waits `timeout` expired", async () => {
            const elapsed_sec = await host.call(
              "eval",
              "g:__test_denops_wait_elapsed",
            ) as number;
            assertGreater(elapsed_sec, 1.0);
            assertLess(elapsed_sec, 5.0);
          });

          await t.step("returns -1", async () => {
            const actual = await host.call(
              "eval",
              "g:__test_denops_wait_result",
            );
            assertEquals(actual, -1);
          });

          await t.step("outputs an error message", async () => {
            await delay(MESSAGE_DELAY);
            assertStringIncludes(
              outputs.join(""),
              'Failed to wait for "notexistsplugin" to start. It took more than 1000 milliseconds and timed out.',
            );
          });
        });

        await t.step("if `silent=1`", async (t) => {
          outputs = [];
          await host.call("execute", [
            "let g:__test_denops_wait_start = reltime()",
            "let g:__test_denops_wait_result = denops#plugin#wait('notexistsplugin', {'timeout': 1000, 'silent': 1})",
            "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
          ], "");

          await t.step("waits `timeout` expired", async () => {
            const elapsed_sec = await host.call(
              "eval",
              "g:__test_denops_wait_elapsed",
            ) as number;
            assertGreater(elapsed_sec, 1.0);
            assertLess(elapsed_sec, 5.0);
          });

          await t.step("returns -1", async () => {
            const actual = await host.call(
              "eval",
              "g:__test_denops_wait_result",
            );
            assertEquals(actual, -1);
          });

          await t.step("does not output error messages", async () => {
            await delay(MESSAGE_DELAY);
            assertEquals(outputs, []);
          });
        });
      });

      await t.step("if `denops#_internal#wait#timeout` expires", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:denops#_internal#wait#timeout = 500",
          "call denops#plugin#wait('notexistsplugin', {'timeout': 1000})",
        ], "");

        await t.step("outputs an warning message", async () => {
          await delay(MESSAGE_DELAY);
          assertStringIncludes(
            outputs.join(""),
            "It tooks more than 500 ms. Use Ctrl-C to cancel.",
          );
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
          await host.call("execute", [
            "let g:__test_denops_wait_start = reltime()",
            "let g:__test_denops_wait_result = denops#plugin#wait('dummy', {'timeout': 1000})",
            "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
          ], "");

          await t.step("returns immediately", async () => {
            const elapsed_sec = await host.call(
              "eval",
              "g:__test_denops_wait_elapsed",
            ) as number;
            assertLess(elapsed_sec, 0.1);
          });

          await t.step("returns -2", async () => {
            const actual = await host.call(
              "eval",
              "g:__test_denops_wait_result",
            );
            assertEquals(actual, -2);
          });

          await t.step("outputs an error message", async () => {
            await delay(MESSAGE_DELAY);
            assertStringIncludes(
              outputs.join(""),
              'Failed to wait for "dummy" to start. Denops server itself is not started.',
            );
          });
        });

        await t.step("if `silent=1`", async (t) => {
          outputs = [];
          await host.call("execute", [
            "let g:__test_denops_wait_start = reltime()",
            "let g:__test_denops_wait_result = denops#plugin#wait('dummy', {'timeout': 1000, 'silent': 1})",
            "let g:__test_denops_wait_elapsed = g:__test_denops_wait_start->reltime()->reltimefloat()",
          ], "");

          await t.step("returns immediately", async () => {
            const elapsed_sec = await host.call(
              "eval",
              "g:__test_denops_wait_elapsed",
            ) as number;
            assertLess(elapsed_sec, 0.1);
          });

          await t.step("returns -2", async () => {
            const actual = await host.call(
              "eval",
              "g:__test_denops_wait_result",
            );
            assertEquals(actual, -2);
          });

          await t.step("does not output error messages", async () => {
            await delay(MESSAGE_DELAY);
            assertEquals(outputs, []);
          });
        });
      });
    });
  },
});

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../../testdata/${path}`);
}
