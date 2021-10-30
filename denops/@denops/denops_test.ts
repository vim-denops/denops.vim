import * as path from "https://deno.land/std@0.111.0/path/mod.ts";
import {
  assertEquals,
  assertThrowsAsync,
} from "https://deno.land/std@0.111.0/testing/asserts.ts";
import { test } from "./test/tester.ts";
import { BatchError } from "./denops.ts";

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
  name: "denops.call() calls a Vim/Neovim function and throw an error",
  fn: async (denops) => {
    await assertThrowsAsync(
      async () => {
        await denops.call("no-such-function");
      },
      undefined,
      "E117: Unknown function: no-such-function",
    );
  },
  prelude: ["let g:denops#enable_workaround_vim_before_8_2_3081 = 1"],
});

test({
  mode: "all",
  name:
    "denops.call() drop arguments after `undefined` (but `null`) for convenience",
  fn: async (denops) => {
    assertEquals(
      await denops.call("denops#api#id", 0, 1, 2),
      [0, 1, 2],
    );
    assertEquals(
      await denops.call("denops#api#id", 0, 1, undefined, 2),
      [0, 1],
    );
    assertEquals(
      await denops.call("denops#api#id", 0, undefined, 1, 2),
      [0],
    );
    assertEquals(
      await denops.call("denops#api#id", 0, 1, null, 2),
      [0, 1, null, 2],
    );
    assertEquals(
      await denops.call("denops#api#id", 0, null, 1, 2),
      [0, null, 1, 2],
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
  name: "denops.cmd() invoke a Vim/Neovim command and throw an error",
  fn: async (denops) => {
    await assertThrowsAsync(
      async () => {
        await denops.cmd("NoSuchCommand");
      },
      undefined,
      "E492: Not an editor command: NoSuchCommand",
    );
  },
  prelude: ["let g:denops#enable_workaround_vim_before_8_2_3081 = 1"],
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

test({
  mode: "all",
  name: "denops.eval() evaluate a Vim/Neovim expression and throw an error",
  fn: async (denops) => {
    await assertThrowsAsync(
      async () => {
        await denops.eval("g:no_such_variable");
      },
      undefined,
      "g:no_such_variable",
      // Vim:    "E15: Invalid expression: g:no_such_variable",
      // Neovim: "E121: Undefined variable: g:no_such_variable",
    );
  },
  prelude: ["let g:denops#enable_workaround_vim_before_8_2_3081 = 1"],
});

test({
  mode: "all",
  name: "denops.batch() calls multiple Vim/Neovim functions and return results",
  fn: async (denops) => {
    const results = await denops.batch(["range", 1], ["range", 2], [
      "range",
      3,
    ]);
    assertEquals(results, [[0], [0, 1], [0, 1, 2]]);
  },
});

test({
  mode: "all",
  name:
    "denops.batch() calls multiple Vim/Neovim functions and throws an error with results",
  fn: async (denops) => {
    await assertThrowsAsync(async () => {
      await denops.batch(
        ["range", 1],
        ["no-such-function", 2],
        ["range", 3],
      );
    }, BatchError);
  },
  prelude: ["let g:denops#enable_workaround_vim_before_8_2_3081 = 1"],
});

test({
  mode: "all",
  name:
    "denops.batch() drop arguments after `undefined` (but `null`) for convenience",
  fn: async (denops) => {
    const results = await denops.batch(
      ["denops#api#id", 0, 1, 2],
      ["denops#api#id", 0, 1, undefined, 2],
      ["denops#api#id", 0, undefined, 1, 2],
      ["denops#api#id", 0, 1, null, 2],
      ["denops#api#id", 0, null, 1, 2],
    );
    assertEquals(results, [[0, 1, 2], [0, 1], [0], [0, 1, null, 2], [
      0,
      null,
      1,
      2,
    ]]);
  },
});

test({
  mode: "all",
  name: "denops.call() works properly even when called concurrently",
  fn: async (denops) => {
    const cwd = await denops.call("getcwd") as string;
    await denops.cmd("edit dummy1");
    await denops.cmd("file dummy2");
    const results = await Promise.all([
      denops.call("expand", "%"),
      denops.call("expand", "%:p"),
      denops.call("expand", "%hello"),
      denops.call("expand", "#"),
      denops.call("expand", "#:p"),
      denops.call("expand", "#hello"),
    ]);
    assertEquals(results, [
      "dummy2",
      path.join(cwd, "dummy2"),
      "dummy2",
      "dummy1",
      path.join(cwd, "dummy1"),
      "dummy1",
    ]);
  },
});
