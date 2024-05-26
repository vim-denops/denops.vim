import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "jsr:@lambdalisue/workerio@4.0.0";
import { parseArgs } from "jsr:@std/cli/parse-args";

// Disable "Native acceleration" feature of `msgpackr` as an workaround of Deno panic.
// https://github.com/denoland/deno/issues/23792
Deno.env.set("MSGPACKR_NATIVE_ACCELERATION_DISABLED", "true");

const WORKER_SCRIPT = import.meta.resolve("./worker.ts");

async function handleConn(
  conn: Deno.TcpConn,
  { quiet }: { quiet?: boolean },
): Promise<void> {
  const remoteAddr = conn.remoteAddr;
  const name = `${remoteAddr.hostname}:${remoteAddr.port}`;
  if (!quiet) {
    console.info(`${name} is connected`);
  }

  const worker = new Worker(WORKER_SCRIPT, {
    name,
    type: "module",
  });
  const reader = readableStreamFromWorker(worker);
  const writer = writableStreamFromWorker(worker);

  try {
    await Promise.race([
      reader.pipeTo(conn.writable),
      conn.readable.pipeTo(writer),
    ]);
  } finally {
    // Terminate worker to avoid leak
    worker.terminate();
  }
}

export async function main(args: string[]): Promise<void> {
  const { hostname, port, quiet, identity } = parseArgs(args, {
    string: ["hostname", "port"],
    boolean: ["quiet", "identity"],
  });

  const listener = Deno.listen({
    hostname: hostname ?? "127.0.0.1",
    port: Number(port ?? "32123"),
  });
  const localAddr = listener.addr;

  if (identity) {
    // WARNING:
    // This output must be the first line of the stdout to proerply identity the address.
    console.log(`${localAddr.hostname}:${localAddr.port}`);
  }
  if (!quiet) {
    console.info(
      `Listen denops clients on ${localAddr.hostname}:${localAddr.port}`,
    );
  }

  for await (const conn of listener) {
    handleConn(conn, { quiet }).catch((err) =>
      console.error(
        "Internal error occurred and Host/Denops connection is dropped",
        err,
      )
    );
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
