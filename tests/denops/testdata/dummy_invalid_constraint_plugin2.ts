import type { Entrypoint } from "jsr:@denops/core@^7.0.0";

export const main: Entrypoint = (_denops) => {
  // Mimic the situation
  throw new TypeError(
    "Could not find version of '@std/path' that matches specified version constraint '0.225.2'",
  );
};
