import type { Entrypoint } from "jsr:@denops/core";

export const main: Entrypoint = async (denops) => {
  denops.dispatcher = {
    test: async (...args) => {
      await denops.cmd(`echo 'This is test call: ${JSON.stringify(args)}'`);
    },
  };
  await denops.cmd("echo 'Hello, Denops!'");
};
