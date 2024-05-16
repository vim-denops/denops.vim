import type { Entrypoint } from "jsr:@denops/core@6.1.0";

export const main: Entrypoint = async (denops) => {
  await denops.cmd("echo 'I will throw an Error!'");
  throw new Error("This is dummy error");
};
