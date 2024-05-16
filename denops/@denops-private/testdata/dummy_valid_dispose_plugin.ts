// TODO: #349 Import `Entrypoint` from denops-core.
// import type { Entrypoint } from "jsr:@denops/core@6.1.0";
import type { Entrypoint } from "../plugin.ts";

export const main: Entrypoint = (denops) => {
  return {
    [Symbol.asyncDispose]: async () => {
      await denops.cmd("echo 'Goodbye, Denops!'");
    },
  };
};
