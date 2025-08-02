import type { Entrypoint } from "@denops/core";
import { delay } from "@std/async/delay";

export const main: Entrypoint = async (_denops) => {
  await delay(1000);
  throw new Error("This is dummy error");
};
