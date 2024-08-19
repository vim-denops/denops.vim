import {
  assertArrayIncludes,
  assertEquals,
  assertMatch,
} from "jsr:@std/assert@^1.0.1";
import { delay } from "jsr:@std/async@^1.0.1";
import { join } from "jsr:@std/path@^1.0.2/join";
import { testHost } from "/denops-testutil/host.ts";
import { wait } from "/denops-testutil/wait.ts";

const MESSAGE_DELAY = 200; // msc

const runtimepathPlugin = resolve("dummy_plugins");

testHost({
  name: "denops#plugin#discover()",
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

    outputs = [];
    await host.call("execute", [
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
  },
});

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../../../testdata/${path}`);
}
