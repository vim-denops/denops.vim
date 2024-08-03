import type { Entrypoint } from "jsr:@denops/core@^7.0.0";

export const main: Entrypoint = (_denops) => {
  throw new Error("This is dummy error");
};
