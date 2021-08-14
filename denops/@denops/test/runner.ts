export const DENOPS_TEST_VIM = Deno.env.get("DENOPS_TEST_VIM");
export const DENOPS_TEST_NVIM = Deno.env.get("DENOPS_TEST_NVIM");

/**
 * Run options.
 */
export type RunOptions = {
  verbose?: boolean;
  commands?: string[];
  env?: Record<string, string>;
};

/**
 * Run Vim/Neovim in background for testing.
 */
export function run(
  mode: "vim" | "nvim",
  options: RunOptions = {},
): Deno.Process {
  const args = mode === "vim" ? buildVimArgs() : buildNvimArgs();
  const cmds = (options.commands ?? []).map((c) => ["-c", c]).flat();
  if (options.verbose) {
    cmds.unshift("--cmd", "redir >> /dev/stdout");
  }
  const proc = Deno.run({
    cmd: [...args, ...cmds],
    env: options.env,
    stdin: "piped",
    stdout: options.verbose ? "inherit" : "null",
    stderr: options.verbose ? "inherit" : "null",
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
    "-n",
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
    "-n",
  ];
}
