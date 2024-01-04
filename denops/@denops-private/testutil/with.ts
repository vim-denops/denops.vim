import { ADDR_ENV_NAME } from "./cli.ts";
import { getConfig } from "./conf.ts";

const script = new URL("./cli.ts", import.meta.url);

export type Fn<T> = (
  reader: ReadableStream<Uint8Array>,
  writer: WritableStream<Uint8Array>,
) => Promise<T>;

export type WithOptions<T> = {
  fn: Fn<T>;
  prelude?: string[];
  postlude?: string[];
  env?: Record<string, string>;
};

export function withVim<T>(
  options: WithOptions<T>,
): Promise<T> {
  const conf = getConfig();
  const exec = Deno.execPath();
  const commands = [
    ...(options.prelude ?? []),
    `set runtimepath^=${conf.denopsPath}`,
    `let g:denops_test_channel = job_start(['${exec}', 'run', '--allow-all', '${script}'], {'mode': 'json', 'err_mode': 'nl'})`,
    ...(options.postlude ?? []),
  ];
  const cmd = conf.vimExecutable;
  const args = [
    "-u",
    "NONE", // Disable vimrc, plugins, defaults.vim
    "-i",
    "NONE", // Disable viminfo
    "-n", // Disable swap file
    "-N", // Disable compatible mode
    "-X", // Disable xterm
    "-e", // Start Vim in Ex mode
    "-s", // Silent or batch mode
    ...commands.flatMap((c) => ["-c", c]),
  ];
  return withProcess(cmd, args, conf.verbose, options);
}

export function withNeovim<T>(
  options: WithOptions<T>,
): Promise<T> {
  const conf = getConfig();
  const exec = Deno.execPath();
  const commands = [
    ...(options.prelude ?? []),
    `set runtimepath^=${conf.denopsPath}`,
    `let g:denops_test_channel = jobstart(['${exec}', 'run', '--allow-all', '${script}'], {'rpc': v:true})`,
    ...(options.postlude ?? []),
  ];
  const cmd = conf.nvimExecutable;
  const args = [
    "--clean",
    "--embed",
    "--headless",
    "-n",
    ...commands.flatMap((c) => ["-c", c]),
  ];
  return withProcess(cmd, args, conf.verbose, options);
}

async function withProcess<T>(
  cmd: string,
  args: string[],
  verbose: boolean,
  { fn, env }: WithOptions<T>,
): Promise<T> {
  const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0, // Automatically select free port
  });
  if (verbose) {
    args.unshift("--cmd", "redir >> /dev/stdout");
  }
  const command = new Deno.Command(cmd, {
    args,
    stdin: "piped",
    stdout: verbose ? "inherit" : "null",
    stderr: verbose ? "inherit" : "null",
    env: {
      ...env,
      [ADDR_ENV_NAME]: JSON.stringify(listener.addr),
    },
  });
  const proc = command.spawn();
  const conn = await listener.accept();
  try {
    return await fn(conn.readable, conn.writable);
  } finally {
    listener.close();
    proc.kill();
    await Promise.all([
      proc.stdin?.close(),
      proc.output(),
    ]);
  }
}
