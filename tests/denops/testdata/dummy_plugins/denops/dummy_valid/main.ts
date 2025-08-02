import type { Entrypoint } from "@denops/core";

export const main: Entrypoint = async (denops) => {
  await denops.cmd("echo 'Hello, Denops!'");
};
