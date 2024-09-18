import { delay } from "jsr:@std/async@^1.0.1/delay";
import type { Entrypoint } from "jsr:@denops/core@^7.0.0";

export const main: Entrypoint = (denops) => {
  denops.dispatcher = {
    test: async (...args) => {
      await delay(100);
      await denops.cmd(
        `execute 'doautocmd <nomodeline> User' fnameescape('DummyDispatcherPlugin:TestCalled:${
          JSON.stringify(args)
        }')`,
      );
      return { result: "OK", args };
    },
  };
};
