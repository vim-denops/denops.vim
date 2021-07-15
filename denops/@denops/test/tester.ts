import { path, Session, using } from "../deps.ts";
import { deadline } from "../deps_test.ts";
import { Denops, DenopsImpl, Meta } from "../denops.ts";
import { DENOPS_TEST_NVIM, DENOPS_TEST_VIM, run } from "./runner.ts";

const DEFAULT_TIMEOUT = 1000;

const DENOPS_PATH = Deno.env.get("DENOPS_PATH");

type WithDenopsOptions = {
  timeout?: number;
  verbose?: boolean;
};

async function withDenops(
  mode: "vim" | "nvim",
  main: (denops: Denops) => Promise<void> | void,
  options: WithDenopsOptions,
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
  const pluginName = "@denops-core-test";
  const proc = run(mode, {
    commands: [
      `let g:denops#_test = 1`,
      `set runtimepath^=${DENOPS_PATH}`,
      `autocmd User DenopsReady call denops#plugin#register('${pluginName}', '${scriptPath}')`,
      "call denops#server#start()",
    ],
    env: {
      "DENOPS_TEST_ADDRESS": JSON.stringify(listener.addr),
    },
    verbose: options.verbose,
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
        const meta = await session.call("call", "denops#util#meta") as Meta;
        const denops: Denops = new DenopsImpl(pluginName, meta, session);
        const runner = async () => {
          await main(denops);
        };
        await deadline(runner(), options.timeout ?? DEFAULT_TIMEOUT);
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
  mode: "vim" | "nvim" | "any" | "all";
  fn: (denops: Denops) => Promise<void> | void;
  timeout?: number;
  verbose?: boolean;
};

/**
  * Register a test which will be run when `deno test` is used on the command line
  * and the containing module looks like a test module.
  *
  * `fn` receive `denops` instance which communicate with a real Vim/Neovim.
   *
   * To use this function, developer must provides the following environment variables:
   *
   * `DENOPS_PATH`
   * A path to `denops.vim` for adding to Vim's `runtimepath`
   *
   * `DENOPS_TEST_VIM`
   * An executable of Vim
   *
   * `DENOPS_TEST_NVIM`
   * An executable of Neovim
   *
   * Otherwise tests using this static method will be ignored.
  */
export function test(
  mode: TestDefinition["mode"],
  name: string,
  fn: TestDefinition["fn"],
): void;
export function test(t: TestDefinition): void;
export function test(
  modeOrDefinition: TestDefinition["mode"] | TestDefinition,
  name?: string,
  fn?: TestDefinition["fn"],
): void {
  if (typeof modeOrDefinition === "string") {
    if (!name) {
      throw new Error(`'name' attribute is required`);
    }
    if (!fn) {
      throw new Error(`'fn' attribute is required`);
    }
    testInternal({
      mode: modeOrDefinition,
      name,
      fn,
    });
  } else {
    testInternal(modeOrDefinition);
  }
}

function testInternal(t: TestDefinition): void {
  const mode = t.mode;
  if (mode === "all") {
    testInternal({
      ...t,
      name: `${t.name} (vim)`,
      mode: "vim",
    });
    testInternal({
      ...t,
      name: `${t.name} (nvim)`,
      mode: "nvim",
    });
  } else if (mode === "any") {
    const m = DENOPS_TEST_NVIM ? "nvim" : "vim";
    testInternal({
      ...t,
      name: `${t.name} (${m})`,
      mode: m,
    });
  } else {
    Deno.test({
      ...t,
      ignore: t.ignore || !DENOPS_PATH ||
        (mode === "vim" && !DENOPS_TEST_VIM) ||
        (mode === "nvim" && !DENOPS_TEST_NVIM),
      fn: async () => {
        await withDenops(mode, t.fn, {
          timeout: t.timeout,
          verbose: t.verbose,
        });
      },
    });
  }
}
