import { path, Session, using } from "../deps.ts";
import { Denops } from "../denops.ts";
import { DENOPS_TEST_NVIM, DENOPS_TEST_VIM, run } from "./runner.ts";

const DENOPS_PATH = Deno.env.get("DENOPS_PATH");

async function withDenops(
  mode: "vim" | "nvim",
  main: (denops: Denops) => Promise<void> | void,
) {
  if (!DENOPS_PATH) {
    throw new Error("`DENOPS_PATH` environment variable is not defined");
  }
  const denopsPath = path.resolve(DENOPS_PATH);
  const scriptPath = path.join(
    denopsPath,
    "denops",
    "@denops",
    "test",
    "bypass",
    "cli.ts",
  );
  const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0, // Automatically select free port
  });
  const proc = run(mode, {
    commands: [
      `set runtimepath^=${DENOPS_PATH}`,
      `autocmd User DenopsReady call denops#plugin#register('denops-std-test', '${scriptPath}')`,
      "call denops#server#start()",
    ],
    env: {
      "DENOPS_TEST_ADDRESS": JSON.stringify(listener.addr),
    },
  });
  const conn = await listener.accept();
  try {
    await using(
      new Session(conn, conn, {}, {
        errorCallback(e) {
          if (e.name === "Interrupted") {
            return;
          }
          console.error("Unexpected error occurred", e);
        },
      }),
      async (session) => {
        const denops = new Denops("denops-std-test", session);
        await main(denops);
      },
    );
  } finally {
    proc.stdin?.close();
    proc.close();
    conn.close();
    listener.close();
  }
}

export type TestDefinition = Omit<Deno.TestDefinition, "fn"> & {
  mode: "vim" | "nvim" | "both" | "one";
  fn: (denops: Denops) => Promise<void> | void;
};

/**
  * Register a test which will berun when `deno test` is used on the command line
  * and the containing module looks like a test module.
  *
  * `fn` receive `denops` instance which communicate with real Vim/Neovim.
   *
   * To use this function, developer must provides the following environment variables:
   *
   * DENOPS_PATH      - A path to `denops.vim` for adding to Vim's `runtimepath`
   * DENOPS_TEST_VIM  - An executable of Vim
   * DENOPS_TEST_NVIM - An executable of Neovim
   *
   * Otherwise tests using this static method will be ignored.
  */
export function test(t: TestDefinition): void {
  const mode = t.mode;
  if (mode === "both") {
    test({
      ...t,
      name: `${t.name} (vim)`,
      mode: "vim",
    });
    test({
      ...t,
      name: `${t.name} (nvim)`,
      mode: "nvim",
    });
  } else if (mode === "one") {
    const m = DENOPS_TEST_NVIM ? "nvim" : "vim";
    test({
      ...t,
      name: `${t.name} (${m})`,
      mode: m,
    });
  } else {
    Deno.test({
      ...t,
      ignore: !DENOPS_PATH || (mode === "vim" && !DENOPS_TEST_VIM) ||
        (mode === "nvim" && !DENOPS_TEST_NVIM),
      fn: async () => {
        await withDenops(mode, t.fn);
      },
    });
  }
}
