import { assertMatch } from "jsr:@std/assert@0.225.2";
import {
  testHost,
  withHost,
} from "../../denops/@denops-private/testutil/host.ts";
import { useSharedServer } from "../../denops/@denops-private/testutil/shared_server.ts";
import { wait } from "../../denops/@denops-private/testutil/wait.ts";

testHost({
  name:
    "'plugin/denops.vim' starts a local server when sourced before VimEnter",
  postlude: [
    "runtime plugin/denops.vim",
  ],
  fn: async ({ host }) => {
    await wait(() => host.call("eval", "!has('vim_starting')"));
    const actual = await host.call("denops#server#status") as string;
    assertMatch(actual, /^(starting|preparing|running)$/);
  },
});

testHost({
  name: "'plugin/denops.vim' starts a local server when sourced after VimEnter",
  fn: async ({ host }) => {
    await wait(() => host.call("eval", "!has('vim_starting')"));
    await host.call("execute", [
      "runtime plugin/denops.vim",
    ], "");
    const actual = await host.call("denops#server#status") as string;
    assertMatch(actual, /^(starting|preparing|running)$/);
  },
});

for (const mode of ["vim", "nvim"] as const) {
  Deno.test(
    `'plugin/denops.vim' connects to the shared server when sourced before VimEnter (${mode})`,
    async () => {
      await using server = await useSharedServer();
      await withHost({
        mode,
        postlude: [
          `let g:denops_server_addr = '${server.addr}'`,
          "runtime plugin/denops.vim",
        ],
        fn: async ({ host }) => {
          await wait(() => host.call("eval", "!has('vim_starting')"));
          const actual = await host.call("denops#server#status") as string;
          assertMatch(actual, /^(preparing|running)$/);
        },
      });
    },
  );
}
