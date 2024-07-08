import type { Entrypoint } from "jsr:@denops/core";

export const main: Entrypoint = (denops) => {
  return {
    [Symbol.asyncDispose]: async () => {
      await denops.cmd("echo 'Goodbye, Denops!'");
    },
  };
};
