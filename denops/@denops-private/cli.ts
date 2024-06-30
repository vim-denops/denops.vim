import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts";
import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";

const script = new URL("./worker.ts", import.meta.url);

async function handleConn(
  conn: Deno.Conn,
  { quiet }: { quiet?: boolean },
): Promise<void> {
  const remoteAddr = conn.remoteAddr as Deno.NetAddr;
  const name = `${remoteAddr.hostname}:${remoteAddr.port}`;
  if (!quiet) {
    console.info(`${name} is connected`);
  }

  const worker = new Worker(script, {
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

async function main(): Promise<void> {
  const { hostname, port, quiet, identity } = parseArgs(Deno.args, {
    string: ["hostname", "port"],
    boolean: ["quiet", "identity"],
  });

  const listener = Deno.listen({
    hostname: hostname ?? "127.0.0.1",
    port: Number(port ?? "32123"),
  });
  const localAddr = listener.addr as Deno.NetAddr;

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
  await main();
}
