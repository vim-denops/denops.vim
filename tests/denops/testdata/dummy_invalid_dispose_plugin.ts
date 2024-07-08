import type { Entrypoint } from "jsr:@denops/core";

export const main: Entrypoint = (_denops) => {
  return {
    [Symbol.asyncDispose]: () => {
      throw new Error("This is dummy error in async dispose");
    },
  };
};
