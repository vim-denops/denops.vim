import type { Entrypoint } from "https://deno.land/x/denops_core@v6.1.0/mod.ts";

export const main: Entrypoint = async (denops) => {
  denops.dispatcher = {
    test: async (...args) => {
      await denops.cmd(`echo 'This is test call: ${JSON.stringify(args)}'`);
    },
  };
  await denops.cmd("echo 'Hello, Denops!'");
};
