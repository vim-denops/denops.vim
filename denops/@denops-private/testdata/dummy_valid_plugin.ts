import type { Denops } from "https://deno.land/x/denops_core@v6.0.5/mod.ts";

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    test: async (...args) => {
      await denops.cmd(`echo 'This is test call: ${JSON.stringify(args)}'`);
    },
  };
  await denops.cmd("echo 'Hello, Denops!'");
}
