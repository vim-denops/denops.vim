import type { Entrypoint } from "jsr:@denops/core@7.0.0-pre1";
import { delay } from "jsr:@std/async@0.224.0/delay";

export const main: Entrypoint = async (_denops) => {
  await delay(1000);
  throw new Error("This is dummy error");
};
