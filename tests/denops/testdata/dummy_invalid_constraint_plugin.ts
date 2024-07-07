import type { Entrypoint } from "jsr:@denops/core";

export const main: Entrypoint = (_denops) => {
  // Mimic the situation
  throw new TypeError(
    "Could not find constraint in the list of versions: @std/encoding@0.224.3",
  );
};
