import { delay } from "@std/async/delay";
import type { Entrypoint } from "@denops/core";

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
