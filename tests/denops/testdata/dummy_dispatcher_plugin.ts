import { delay } from "jsr:@std/async@^1.0.1/delay";
import type { Entrypoint } from "jsr:@denops/core@^7.0.0";

const MIMIC_DISPATCHER_METHOD_DELAY = 100;

export const main: Entrypoint = (denops) => {
  denops.dispatcher = {
    test: async (...args) => {
      await delay(MIMIC_DISPATCHER_METHOD_DELAY);
      await denops.cmd(
        `doautocmd <nomodeline> User DummyDispatcherPlugin:TestCalled:${
          JSON.stringify(args).replaceAll(/[ \\"]/g, "\\$&")
        }`,
      );
      return { result: "OK", args };
    },
    fail: async () => {
      await delay(MIMIC_DISPATCHER_METHOD_DELAY);
      throw new Error("Dummy failure");
    },
  };
};
