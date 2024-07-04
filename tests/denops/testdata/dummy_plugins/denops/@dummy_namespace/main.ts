import type { Entrypoint } from "https://deno.land/x/denops_core@v6.1.0/mod.ts";

// NOTE: This should not be called, a directory starting with '@' is not a denops plugin.
export const main: Entrypoint = async (denops) => {
  await denops.cmd("echo 'Hello, Denops!'");
};
