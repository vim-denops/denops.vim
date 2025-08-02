import type { Entrypoint } from "@denops/core";
import { delay } from "@std/async/delay";

const MIMIC_ABORT_DELAY = 100;

export const main: Entrypoint = (denops) => {
  /** Reset interrupt event handler. */
  function reset(): void {
    const signal = denops.interrupted;
    signal?.addEventListener("abort", async () => {
      await delay(MIMIC_ABORT_DELAY);
      await denops.cmd(
        `doautocmd <nomodeline> User DummyInterruptPlugin:Interrupted:${
          String(signal.reason).replaceAll(/[ \\"]/g, "\\$&")
        }`,
      );
    }, { once: true });
  }
  reset();

  denops.dispatcher = {
    reset,
  };
};
