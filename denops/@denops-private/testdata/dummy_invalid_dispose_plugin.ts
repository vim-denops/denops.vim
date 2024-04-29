// TODO: #349 Import `Entrypoint` from denops-core.
// import type { Entrypoint } from "jsr:@denops/core@6.1.0";
import type { Entrypoint } from "../plugin.ts";

export const main: Entrypoint = (_denops) => {
  return {
    [Symbol.asyncDispose]: () => {
      throw new Error("This is dummy error in async dispose");
    },
  };
};
