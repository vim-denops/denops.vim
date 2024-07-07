import type { Entrypoint } from "jsr:@denops/core";

export const main: Entrypoint = async (denops) => {
  await denops.cmd("echo 'Hello, Denops!'");
};
