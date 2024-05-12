import type { Denops } from "jsr:@denops/core@6.0.6";

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    test: async (...args) => {
      await denops.cmd(`echo 'This is test call: ${JSON.stringify(args)}'`);
    },
  };
  await denops.cmd("echo 'Hello, Denops!'");
}
