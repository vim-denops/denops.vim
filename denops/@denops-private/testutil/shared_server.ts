import { assert } from "jsr:@std/assert@0.225.2";
import { deadline } from "jsr:@std/async@0.224.0/deadline";
import { resolve } from "jsr:@std/path@0.224.0/resolve";
import { TextLineStream } from "jsr:@std/streams@0.224.0/text-line-stream";
import { pop } from "jsr:@lambdalisue/streamtools@1.0.0";
import { getConfig } from "./conf.ts";

const DEFAULT_TIMEOUT = 30_000;

export interface UseSharedServerOptions {
  /** Print shared-server messages. */
  verbose?: boolean;
  /** Environment variables.  */
  env?: Record<string, string>;
  /** Timeout for shared server initialization. */
  timeout?: number;
}

export interface UseSharedServerResult extends AsyncDisposable {
  /** Address to connect to the shared server. */
  addr: string;
  /** Shared server standard output. */
  stdout: ReadableStream<string>;
}

/**
 * Start a shared server and return an address for testing.
 */
export async function useSharedServer(
  options?: UseSharedServerOptions,
): Promise<UseSharedServerResult> {
  const { denopsPath, verbose, env, timeout = DEFAULT_TIMEOUT } = {
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
    "0",
  ];
  const proc = new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: verbose ? "inherit" : "null",
    env,
    signal,
  }).spawn();
  try {
    const [stdout, verboseStdout] = proc.stdout
      .pipeThrough(new TextDecoderStream(), { signal })
      .pipeThrough(new TextLineStream())
      .tee();
    if (verbose) {
      verboseStdout.pipeTo(
        new WritableStream({
          write: (out) => console.log(out),
        }),
      ).catch(() => {});
    }
    const addr = await deadline(pop(stdout), timeout);
    assert(typeof addr === "string");
    return {
      addr,
      stdout,
      async [Symbol.asyncDispose]() {
        aborter.abort("useSharedServer disposed");
        await proc.status;
      },
    };
  } catch (e) {
    aborter.abort(e);
    await proc.status;
    throw e;
  }
}
