import type { Entrypoint } from "jsr:@denops/core@^7.0.0";
import { delay } from "jsr:@std/async@^1.0.1/delay";

export const main: Entrypoint = (denops) => {
  function reset(): void {
    const signal = denops.interrupted;
    signal?.addEventListener("abort", async () => {
      await delay(100);
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
