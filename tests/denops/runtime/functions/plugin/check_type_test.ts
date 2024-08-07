import {
  assertMatch,
  assertNotMatch,
  assertRejects,
} from "jsr:@std/assert@^1.0.1";
import { join } from "jsr:@std/path@^1.0.2/join";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const scriptValid = resolve("dummy_valid_plugin.ts");

testHost({
  name: "denops#plugin#check_type()",
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

    await t.step("if no arguments is specified", async (t) => {
      await t.step("if no plugins are loaded", async (t) => {
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type()`,
        ], "");

        await t.step("outputs an info message after delayed", async () => {
          await wait(() => outputs.join("").includes("No plugins are loaded"));
        });
      });

      await t.step("if some plugins are loaded", async (t) => {
        await host.call("execute", [
          `call denops#plugin#load('dummyCheckNoArguments', '${scriptValid}')`,
        ], "");
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type()`,
        ], "");

        await t.step("outputs an info message after delayed", async () => {
          await wait(() => outputs.join("").includes("Type check"));
          assertMatch(outputs.join(""), /Type check succeeded/);
        });
      });

      await t.step("if not exists plugins are tried to load", async (t) => {
        await host.call("execute", [
          "call denops#plugin#load('notexistsplugin', 'path-to-not-exists-plugin.ts')",
        ], "");
        outputs = [];
        await host.call("execute", [
          "let g:__test_denops_events = []",
          `call denops#plugin#check_type()`,
        ], "");

        await t.step("outputs an error message after delayed", async () => {
          await wait(() => outputs.join("").includes("Type check"));
          assertMatch(outputs.join(""), /Type check failed:/);
        });

        await t.step("does not outputs an usage", () => {
          assertNotMatch(outputs.join(""), /Usage:/);
        });
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
        `call denops#plugin#check_type('notloadedplugin')`,
      ], "");

      await t.step("outputs an info message after delayed", async () => {
        await wait(() => outputs.join("").includes("No plugins are loaded"));
      });

      await t.step("does not outputs an usage", () => {
        assertNotMatch(outputs.join(""), /Usage:/);
      });
    });

    await t.step("if the plugin is not exists", async (t) => {
      await host.call("execute", [
        "call denops#plugin#load('notexistsplugin', 'path-to-not-exists-plugin.ts')",
      ], "");
      outputs = [];
      await host.call("execute", [
        "let g:__test_denops_events = []",
        `call denops#plugin#check_type('notexistsplugin')`,
      ], "");

      await t.step("outputs an error message after delayed", async () => {
        await wait(() => outputs.join("").includes("Type check"));
        assertMatch(outputs.join(""), /Type check failed:/);
      });

      await t.step("does not outputs an usage", () => {
        assertNotMatch(outputs.join(""), /Usage:/);
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
  },
});

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../../../testdata/${path}`);
}
