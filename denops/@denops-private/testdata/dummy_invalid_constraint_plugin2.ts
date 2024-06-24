import type { Entrypoint } from "https://deno.land/x/denops_core@v6.1.0/mod.ts";

export const main: Entrypoint = (_denops) => {
  // Mimic the situation
  throw new TypeError(
    "Could not find version of '@std/path' that matches specified version constraint '0.225.2'",
  );
};
