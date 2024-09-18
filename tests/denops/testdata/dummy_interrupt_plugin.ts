import type { Entrypoint } from "jsr:@denops/core@^7.0.0";
import { delay } from "jsr:@std/async@^1.0.1/delay";

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
