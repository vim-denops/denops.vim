// TODO: #349 Import `Entrypoint` from denops-core.
// import type { Entrypoint } from "jsr:@denops/core@7.0.0";
import type { Entrypoint } from "/denops-private/plugin.ts";

export const main: Entrypoint = (denops) => {
  return {
    [Symbol.asyncDispose]: async () => {
      await denops.cmd("echo 'Goodbye, Denops!'");
    },
  };
};
