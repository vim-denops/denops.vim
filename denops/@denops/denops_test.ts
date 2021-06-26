import { assertEquals } from "./deps_test.ts";
import { test } from "./test/tester.ts";

test(
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

test({
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

test({
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

test(
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

test({
  mode: "any",
  name: "test(mode:any) start vim or nvim to test denops features",
  fn: async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("range", 10),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
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

test(
  "any",
  "test(mode:any) start vim or nvim to test denops features",
  async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("range", 10),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
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

test({
  mode: "all",
  name: "test(mode:all) start both vim and nvim to test denops features",
  fn: async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("range", 10),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
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

test(
  "all",
  "test(mode:all) start both vim and nvim to test denops features",
  async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("range", 10),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
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
