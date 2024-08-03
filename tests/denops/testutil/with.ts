import { channel } from "jsr:@lambdalisue/streamtools@^1.0.0";
import { tap } from "jsr:@milly/streams@^1.0.0/transform/tap";
import { ADDR_ENV_NAME } from "./cli.ts";
import { getConfig } from "./conf.ts";

const script = new URL("./cli.ts", import.meta.url);
const origLog = console.log.bind(console);
const origError = console.error.bind(console);
const noop = () => {};

export type Fn<T> = (helper: {
  reader: ReadableStream<Uint8Array>;
  writer: WritableStream<Uint8Array>;
  stdout: ReadableStream<string>;
  stderr: ReadableStream<string>;
}) => T;

export interface WithOptions<T> {
  fn: Fn<T>;
  /** Print Vim messages (echomsg). */
  verbose?: boolean;
  /** Vim commands to be executed before the startup. */
  prelude?: string[];
  /** Vim commands to be executed after the startup.  */
  postlude?: string[];
  /** Environment variables.  */
  env?: Record<string, string>;
}

export function withVim<T>(
  options: WithOptions<T>,
): Promise<Awaited<T>> {
  const conf = getConfig();
  const exec = Deno.execPath();
  const commands = [
    ...(options.prelude ?? []),
    `set runtimepath^=${conf.denopsPath}`,
    "let g:denops_test_channel = job_start(" +
    `  ['${exec}', 'run', '--allow-all', '${script}'],` +
    `  {'mode': 'json', 'err_mode': 'nl'}` +
    ")",
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
    "-s", // Silent or batch mode ("-e" is required before)
    "-V1", // Verbose level 1 (Echo messages to stderr)
    "-c",
    "visual", // Go to Normal mode
    "-c",
    "set columns=9999", // Avoid unwilling output newline
    ...commands.flatMap((c) => ["-c", c]),
  ];
  return withProcess(cmd, args, { verbose: conf.verbose, ...options });
}

export function withNeovim<T>(
  options: WithOptions<T>,
): Promise<Awaited<T>> {
  const conf = getConfig();
  const exec = Deno.execPath();
  const commands = [
    ...(options.prelude ?? []),
    `set runtimepath^=${conf.denopsPath}`,
    "let g:denops_test_channel = jobstart(" +
    `  ['${exec}', 'run', '--allow-all', '${script}'],` +
    `  {'rpc': v:true}` +
    ")",
    ...(options.postlude ?? []),
  ];
  const cmd = conf.nvimExecutable;
  const args = [
    "--clean",
    "--headless",
    "-n", // Disable swap file
    "-V1", // Verbose level 1 (Echo messages to stderr)
    "-c",
    "set columns=9999", // Avoid unwilling output newline
    ...commands.flatMap((c) => ["-c", c]),
  ];
  return withProcess(cmd, args, { verbose: conf.verbose, ...options });
}

async function withProcess<T>(
  cmd: string,
  args: string[],
  { fn, env, verbose }: WithOptions<T>,
): Promise<Awaited<T>> {
  const aborter = new AbortController();
  const { signal } = aborter;
  const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0, // Automatically select free port
  });

  const command = new Deno.Command(cmd, {
    args,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    env: {
      ...env,
      [ADDR_ENV_NAME]: JSON.stringify(listener.addr),
    },
    signal,
  });
  const proc = command.spawn();

  let stdout = proc.stdout.pipeThrough(new TextDecoderStream(), { signal });
  let stderr = proc.stderr.pipeThrough(new TextDecoderStream(), { signal });
  if (verbose) {
    stdout = stdout.pipeThrough(tap((s) => origLog(s)));
    stderr = stderr.pipeThrough(tap((s) => origError(s)));
  }
  const { writer: stdoutWriter, reader: stdoutReader } = channel<string>();
  stdout.pipeTo(stdoutWriter).catch(noop);
  const { writer: stderrWriter, reader: stderrReader } = channel<string>();
  stderr.pipeTo(stderrWriter).catch(noop);

  const conn = await listener.accept();
  try {
    return await fn({
      reader: conn.readable,
      writer: conn.writable,
      stdout: stdoutReader,
      stderr: stderrReader,
    });
  } finally {
    listener.close();
    try {
      aborter.abort("withProcess disposed");
    } catch {
      // Already exited, do nothing.
    }
    await Promise.all([
      proc.stdin.close(),
      proc.status,
    ]);
    await Promise.all([
      proc.stdout.cancel(),
      proc.stderr.cancel(),
    ]);
  }
}
