import { path } from "../deps.ts";
import { Denops } from "../denops.ts";
import { DENOPS_TEST_NVIM, DENOPS_TEST_VIM, run } from "./runner.ts";

const SCRIPT_PATH = path.fromFileUrl(new URL("cli/bypass.ts", import.meta.url));
const DENOPS_PATH = path.fromFileUrl(new URL("../../..", import.meta.url));

async function withDenops(
  mode: "vim" | "nvim",
  main: (denops: Denops) => Promise<void> | void,
) {
  const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0, // Automatically select free port
  });
  const proc = run(mode, {
    commands: [
      `set runtimepath^=${DENOPS_PATH}`,
      `autocmd User DenopsReady call denops#plugin#register('denops-std-test', '${SCRIPT_PATH}')`,
      "call denops#server#start()",
    ],
    env: {
      "DENOPS_TEST_ADDRESS": JSON.stringify(listener.addr),
    },
  });
  try {
    const conn = await listener.accept();
    const denops = new Denops("denops-std-test", conn, conn);
    try {
      await main(denops);
    } finally {
      denops.cmd("qall!");
      await proc.status();
      proc.stdin?.close();
      proc.close();
      conn.close();
    }
  } finally {
    listener.close();
  }
}

export type TestDefinition = Omit<Deno.TestDefinition, "fn"> & {
  mode: "vim" | "nvim";
  fn: (denops: Denops) => Promise<void> | void;
};

/**
  * Register a test which will berun when `deno test` is used on the command line
  * and the containing module looks like a test module.
  *
  * `fn` receive `denops` instance which communicate with real Vim/Neovim.
  */
export function test(t: TestDefinition): void {
  Deno.test({
    ...t,
    ignore: (t.mode === "vim" && !DENOPS_TEST_VIM) ||
      (t.mode === "nvim" && !DENOPS_TEST_NVIM),
    fn: async () => {
      await withDenops(t.mode, t.fn);
    },
  });
}
