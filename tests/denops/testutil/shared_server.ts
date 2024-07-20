import { assert } from "jsr:@std/assert@1.0.1";
import { deadline } from "jsr:@std/async@1.0.1/deadline";
import { resolve } from "jsr:@std/path@1.0.2/resolve";
import { channel, pop } from "jsr:@lambdalisue/streamtools@1.0.0";
import { tap } from "jsr:@milly/streams@^1.0.0/transform/tap";
import { getConfig } from "./conf.ts";

const DEFAULT_TIMEOUT = 30_000;
const origLog = console.log.bind(console);
const origError = console.error.bind(console);
const noop = () => {};

export interface UseSharedServerOptions {
  /** The port number of the shared server. */
  port?: number;
  /** Print shared-server messages. */
  verbose?: boolean;
  /** Environment variables.  */
  env?: Record<string, string>;
  /** Timeout for shared server initialization. */
  timeout?: number;
}

export interface UseSharedServerResult extends AsyncDisposable {
  /** Address to connect to the shared server. */
  addr: {
    host: string;
    port: number;
    toString(): string;
  };
  /** Shared server standard output. */
  stdout: ReadableStream<string>;
  /** Shared server error output. */
  stderr: ReadableStream<string>;
}

/**
 * Start a shared server and return an address for testing.
 */
export async function useSharedServer(
  options?: UseSharedServerOptions,
): Promise<UseSharedServerResult> {
  const { denopsPath, port = 0, verbose, env, timeout = DEFAULT_TIMEOUT } = {
    ...getConfig(),
    ...options,
  };
  const aborter = new AbortController();
  const { signal } = aborter;

  const cmd = Deno.execPath();
  const script = resolve(denopsPath, "denops/@denops-private/cli.ts");
  const args = [
    "run",
    "-A",
    "--no-lock",
    script,
    "--identity",
    "--port",
    `${port}`,
  ];
  const proc = new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
    env,
    signal,
  }).spawn();

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

  const [addrReader, stdoutReader2] = stdoutReader.tee();
  const addrPromise = pop(addrReader);
  addrPromise.finally(() => addrReader.cancel());

  const abort = async (reason: unknown) => {
    try {
      aborter.abort(reason);
    } catch {
      // Already exited, do nothing.
    }
    await proc.status;
    await Promise.allSettled([
      proc.stdout.cancel(reason),
      proc.stderr.cancel(reason),
    ]);
  };

  try {
    const addr = await deadline(addrPromise, timeout);
    assert(typeof addr === "string");
    const [_, host, port] = addr.match(/^([^:]*):(\d+)(?:\n|$)/) ?? [];
    return {
      addr: {
        host,
        port: Number.parseInt(port),
        toString: () => `${host}:${port}`,
      },
      stdout: stdoutReader2,
      stderr: stderrReader,
      async [Symbol.asyncDispose]() {
        await abort("useSharedServer disposed");
      },
    };
  } catch (e) {
    await abort(e);
    throw e;
  }
}
