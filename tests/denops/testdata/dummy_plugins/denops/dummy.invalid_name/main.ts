import type { Entrypoint } from "@denops/core";

// NOTE: This should not be called, a directory contains '.' is not a valid denops plugin.
export const main: Entrypoint = async (denops) => {
  await denops.cmd("echo 'Hello, Denops!'");
};
