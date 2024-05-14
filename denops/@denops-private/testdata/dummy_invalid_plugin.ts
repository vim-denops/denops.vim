import type { Entrypoint } from "https://deno.land/x/denops_core@v6.1.0/mod.ts";

export const main: Entrypoint = (_denops) => {
  throw new Error("This is dummy error");
};
