import type { Entrypoint } from "@denops/core";

export const main: Entrypoint = (_denops) => {
  return {
    [Symbol.asyncDispose]: () => {
      throw new Error("This is dummy error in async dispose");
    },
  };
};
