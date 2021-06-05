export const DENOPS_TEST_VIM = Deno.env.get("DENOPS_TEST_VIM");
export const DENOPS_TEST_NVIM = Deno.env.get("DENOPS_TEST_NVIM");

const DEFAULT_TIMEOUT = 1000;

/**
 * Run options.
 */
export type RunOptions = {
  commands?: string[];
  timeout?: number;
  env?: Record<string, string>;
};

/**
 * Run Vim/Neovim in background for testing.
 */
export function run(
  mode: "vim" | "nvim",
  options: RunOptions = {},
): Deno.Process {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const args = mode === "vim" ? buildVimArgs() : buildNvimArgs();
  const cmds = [
    "--cmd",
    `call timer_start(${timeout}, { -> execute('qall!') })`,
    ...(options.commands ?? []).map((c) => ["--cmd", c]).flat(),
  ];
  const proc = Deno.run({
    cmd: [...args, ...cmds],
    env: options.env,
    stdin: "piped",
  });
  return proc;
}

function buildVimArgs(): string[] {
  if (!DENOPS_TEST_VIM) {
    throw new Error("`DENOPS_TEST_VIM` environment variable is not defined");
  }
  return [
    DENOPS_TEST_VIM,
    "-u",
    "NONE",
    "-i",
    "NONE",
    "-N",
    "-X",
    "-e",
    "-s",
  ];
}

function buildNvimArgs(): string[] {
  if (!DENOPS_TEST_NVIM) {
    throw new Error("`DENOPS_TEST_NVIM` environment variable is not defined");
  }
  return [
    DENOPS_TEST_NVIM,
    "--clean",
    "--embed",
    "--headless",
  ];
}
