import type { Entrypoint } from "@denops/core";

export const main: Entrypoint = (_denops) => {
  throw new Error("This is dummy error");
};
