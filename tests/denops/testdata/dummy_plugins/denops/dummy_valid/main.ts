import type { Entrypoint } from "jsr:@denops/core@7.0.0";

export const main: Entrypoint = async (denops) => {
  await denops.cmd("echo 'Hello, Denops!'");
};
