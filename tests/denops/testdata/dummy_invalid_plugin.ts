import type { Entrypoint } from "jsr:@denops/core";

export const main: Entrypoint = (_denops) => {
  throw new Error("This is dummy error");
};
