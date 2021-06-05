import { assertEquals } from "./deps_test.ts";
import { Denops } from "./denops.ts";

Denops.test({
  mode: "vim",
  name: "test(mode:vim) start vim to test denops features",
  fn: async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("has", "nvim") as number,
      0,
    );

    // Test if `cmd` works
    await denops.cmd("execute 'let g:denops_test = value'", {
      value: "Hello World",
    });

    // Test if `eval` works
    assertEquals(
      await denops.eval("g:denops_test") as string,
      "Hello World",
    );
  },
});

Denops.test(
  "vim",
  "test(mode:vim) start vim to test denops features",
  async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("has", "nvim") as number,
      0,
    );

    // Test if `cmd` works
    await denops.cmd("execute 'let g:denops_test = value'", {
      value: "Hello World",
    });

    // Test if `eval` works
    assertEquals(
      await denops.eval("g:denops_test") as string,
      "Hello World",
    );
  },
);

Denops.test({
  mode: "nvim",
  name: "test(mode:nvim) start nvim to test denops features",
  fn: async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("has", "nvim") as number,
      1,
    );

    // Test if `cmd` works
    await denops.cmd("execute 'let g:denops_test = value'", {
      value: "Hello World",
    });

    // Test if `eval` works
    assertEquals(
      await denops.eval("g:denops_test") as string,
      "Hello World",
    );
  },
});

Denops.test(
  "nvim",
  "test(mode:nvim) start nvim to test denops features",
  async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("has", "nvim") as number,
      1,
    );

    // Test if `cmd` works
    await denops.cmd("execute 'let g:denops_test = value'", {
      value: "Hello World",
    });

    // Test if `eval` works
    assertEquals(
      await denops.eval("g:denops_test") as string,
      "Hello World",
    );
  },
);
