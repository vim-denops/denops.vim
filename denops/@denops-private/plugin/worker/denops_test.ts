import * as path from "https://deno.land/std@0.208.0/path/mod.ts";
import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { test } from "https://deno.land/x/denops_test@v1.4.0/mod.ts";
import { BatchError } from "../../../@denops/mod.ts";

test({
  mode: "all",
  name: "impl",
  fn: async (denops, t) => {
    await t.step({
      name: "denops.redraw() does nothing",
      fn: async () => {
        assertEquals(
          await denops.redraw(),
          undefined,
        );

        assertEquals(
          await denops.redraw(true),
          undefined,
        );

        assertEquals(
          await denops.redraw(false),
          undefined,
        );
      },
    });

    await t.step({
      name: "denops.call() calls a Vim/Neovim function and return a result",
      fn: async () => {
        assertEquals(
          await denops.call("range", 10),
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        );
      },
    });

    await t.step({
      name: "denops.call() calls a Vim/Neovim function and throw an error",
      fn: async () => {
        await assertRejects(
          async () => {
            await denops.call("no-such-function");
          },
          "E117: Unknown function: no-such-function",
        );
      },
    });

    await t.step({
      name:
        "denops.call() drop arguments after `undefined` (but `null`) for convenience",
      fn: async () => {
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

    await t.step({
      name: "denops.cmd() invoke a Vim/Neovim command",
      fn: async () => {
        await denops.cmd("execute 'let g:denops_test = value'", {
          value: "Hello World",
        });
        assertEquals(
          await denops.eval("g:denops_test") as string,
          "Hello World",
        );
      },
    });

    await t.step({
      name: "denops.cmd() invoke a Vim/Neovim command and throw an error",
      fn: async () => {
        await assertRejects(
          async () => {
            await denops.cmd("NoSuchCommand");
          },
          "E492: Not an editor command: NoSuchCommand",
        );
      },
    });

    await t.step({
      name:
        "denops.eval() evaluate a Vim/Neovim expression and return a result",
      fn: async () => {
        await denops.cmd("execute 'let g:denops_test = value'", {
          value: "Hello World",
        });
        assertEquals(
          await denops.eval("g:denops_test") as string,
          "Hello World",
        );
      },
    });

    await t.step({
      name: "denops.eval() evaluate a Vim/Neovim expression and throw an error",
      fn: async () => {
        await assertRejects(
          async () => {
            await denops.eval("g:no_such_variable");
          },
          "g:no_such_variable",
          // Vim:    "E15: Invalid expression: g:no_such_variable",
          // Neovim: "E121: Undefined variable: g:no_such_variable",
        );
      },
    });

    await t.step({
      name:
        "denops.batch() calls multiple Vim/Neovim functions and return results",
      fn: async () => {
        const results = await denops.batch(["range", 1], ["range", 2], [
          "range",
          3,
        ]);
        assertEquals(results, [[0], [0, 1], [0, 1, 2]]);
      },
    });

    await t.step({
      name:
        "denops.batch() calls multiple Vim/Neovim functions and throws an error with results",
      fn: async () => {
        await assertRejects(async () => {
          await denops.batch(
            ["range", 1],
            ["no-such-function", 2],
            ["range", 3],
          );
        }, BatchError);
      },
    });

    await t.step({
      name:
        "denops.batch() drop arguments after `undefined` (but `null`) for convenience",
      fn: async () => {
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

    await t.step({
      name: "denops.call() works properly even when called concurrently",
      fn: async () => {
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

    await t.step({
      name: "denops.dispatch() invokes APIs of the plugin",
      fn: async () => {
        denops.dispatcher = {
          hello(name: unknown): Promise<unknown> {
            return Promise.resolve(`Hello ${name}`);
          },
        };
        assertEquals(
          await denops.dispatch(denops.name, "hello", "denops"),
          "Hello denops",
        );
      },
    });
  },
});
