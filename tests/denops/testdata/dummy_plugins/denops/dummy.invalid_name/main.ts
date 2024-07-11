import type { Entrypoint } from "jsr:@denops/core@7.0.0-pre1";

// NOTE: This should not be called, a directory contains '.' is not a valid denops plugin.
export const main: Entrypoint = async (denops) => {
  await denops.cmd("echo 'Hello, Denops!'");
};
