import type { Entrypoint } from "@denops/core";

export const main: Entrypoint = (denops) => {
  return {
    [Symbol.asyncDispose]: async () => {
      await denops.cmd("echo 'Goodbye, Denops!'");
    },
  };
};
