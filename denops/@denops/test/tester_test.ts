import { assertEquals } from "../deps_test.ts";
import { test } from "./tester.ts";

test(
  "vim",
  "test(mode:vim) start vim to test denops features",
  async (denops) => {
    // Test if `call` works
    assertEquals(
      await denops.call("has", "nvim") as number,
      0,
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
  },
);
