import * as path from "https://deno.land/std@0.167.0/path/mod.ts";
import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.6/mod.ts#^";
import { using } from "https://deno.land/x/disposable@v1.1.0/mod.ts#^";
import { deadline } from "https://deno.land/std@0.167.0/async/mod.ts";
import type { Denops, Meta } from "../mod.ts";
import { DenopsImpl } from "../impl.ts";
import { DENOPS_TEST_NVIM, DENOPS_TEST_VIM, run } from "./runner.ts";

const DEFAULT_TIMEOUT = Number(
  Deno.env.get("DENOPS_TEST_DEFAULT_TIMEOUT") ?? "30000",
);

const DENOPS_PATH = Deno.env.get("DENOPS_PATH");

type WithDenopsOptions = {
  pluginName?: string;
  timeout?: number;
  verbose?: boolean;
  prelude?: string[];
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
  const pluginName = options.pluginName ?? "@denops-core-test";
  const proc = run(mode, {
    commands: [
      ...(options.prelude ?? []),
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
        const meta = await session.call(
          "call",
          "denops#_internal#meta#get",
        ) as Meta;
        const denops: Denops = new DenopsImpl(pluginName, meta, session);
        const runner = async () => {
          await main(denops);
        };
        await deadline(runner(), options.timeout ?? DEFAULT_TIMEOUT);
      },
    );
  } finally {
    proc.stdin?.close();
    await killProcess(proc);
    await proc.status();
    proc.close();
    conn.close();
    listener.close();
  }
}

export type TestDefinition = Omit<Deno.TestDefinition, "fn"> & {
  mode: "vim" | "nvim" | "any" | "all";
  fn: (denops: Denops, t: Deno.TestContext) => Promise<void> | void;
  pluginName?: string;
  timeout?: number;
  verbose?: boolean;
  prelude?: string[];
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
export function test(def: TestDefinition): void;
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

function testInternal(def: TestDefinition): void {
  const mode = def.mode;
  if (mode === "all") {
    testInternal({
      ...def,
      name: `${def.name} (vim)`,
      mode: "vim",
    });
    testInternal({
      ...def,
      name: `${def.name} (nvim)`,
      mode: "nvim",
    });
  } else if (mode === "any") {
    const m = DENOPS_TEST_NVIM ? "nvim" : "vim";
    testInternal({
      ...def,
      name: `${def.name} (${m})`,
      mode: m,
    });
  } else {
    Deno.test({
      ...def,
      ignore: def.ignore || !DENOPS_PATH ||
        (mode === "vim" && !DENOPS_TEST_VIM) ||
        (mode === "nvim" && !DENOPS_TEST_NVIM),
      fn: async (t) => {
        await withDenops(mode, (denops: Denops) => def.fn(denops, t), {
          pluginName: def.pluginName,
          timeout: def.timeout,
          verbose: def.verbose,
          prelude: def.prelude,
        });
      },
    });
  }
}

async function killProcess(proc: Deno.Process): Promise<void> {
  if (Deno.build.os === "windows") {
    // Signal API in Deno v1.14.0 on Windows
    // does not work so use `taskkill` for now
    const p = Deno.run({
      cmd: ["taskkill", "/pid", proc.pid.toString(), "/F"],
      stdin: "null",
      stdout: "null",
      stderr: "null",
    });
    await p.status();
    p.close();
  } else {
    proc.kill("SIGTERM");
  }
}
