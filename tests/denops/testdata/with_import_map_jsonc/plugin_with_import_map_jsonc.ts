import type { Entrypoint } from "@denops/core";
import { getMessage, greeting } from "@test/helper";

export const main: Entrypoint = async (denops) => {
  denops.dispatcher = {
    test: async () => {
      const message = getMessage("test-plugin");
      await denops.cmd(`echo '${message}'`);
      return greeting;
    },
  };
  await denops.cmd("echo 'Import map jsonc plugin initialized'");
};
