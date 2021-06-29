import { assertEquals } from "./deps_test.ts";
import { test } from "./test/tester.ts";

test({
  mode: "all",
  name: "denops.call() calls a Vim/Neovim function and return a result",
  fn: async (denops) => {
    assertEquals(
      await denops.call("range", 10),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
  },
});

test({
  mode: "all",
  name: "denops.cmd() invoke a Vim/Neovim command",
  fn: async (denops) => {
    await denops.cmd("execute 'let g:denops_test = value'", {
      value: "Hello World",
    });
    assertEquals(
      await denops.eval("g:denops_test") as string,
      "Hello World",
    );
  },
});

test({
  mode: "all",
  name: "denops.eval() evaluate a Vim/Neovim expression and return a result",
  fn: async (denops) => {
    await denops.cmd("execute 'let g:denops_test = value'", {
      value: "Hello World",
    });
    assertEquals(
      await denops.eval("g:denops_test") as string,
      "Hello World",
    );
  },
});
