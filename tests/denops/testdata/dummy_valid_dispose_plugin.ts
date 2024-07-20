import type { Entrypoint } from "jsr:@denops/core@7.0.0";

export const main: Entrypoint = (denops) => {
  return {
    [Symbol.asyncDispose]: async () => {
      await denops.cmd("echo 'Goodbye, Denops!'");
    },
  };
};
