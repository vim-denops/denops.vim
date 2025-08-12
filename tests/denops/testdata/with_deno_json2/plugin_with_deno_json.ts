import type { Entrypoint } from "jsr:@denops/core@^7.0.0";
import { getMessage, greeting } from "@test/helper";

export const main: Entrypoint = async (denops) => {
  denops.dispatcher = {
    test: async () => {
      const message = getMessage("test-plugin");
      await denops.cmd(`echo '${message}'`);
      return greeting;
    },
  };
  await denops.cmd("echo 'Deno json plugin initialized'");
};
