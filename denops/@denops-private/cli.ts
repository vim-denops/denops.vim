import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "jsr:@lambdalisue/workerio@4.0.0";
import { deadline } from "jsr:@std/async@0.224.0/deadline";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { waitProcessSignal } from "./process.ts";

const WORKER_STREAM_CLOSE_MESSAGE = null;
const WORKER_CLOSE_TIMEOUT_MS = 5000;

// Disable "Native acceleration" feature of `msgpackr` as an workaround of Deno panic.
// https://github.com/denoland/deno/issues/23792
Deno.env.set("MSGPACKR_NATIVE_ACCELERATION_DISABLED", "true");

const script = import.meta.resolve("./worker.ts");

async function processWorker(name: string, conn: Deno.Conn): Promise<void> {
  const worker = new Worker(script, {
    name,
    type: "module",
  });
  const reader = readableStreamFromWorker(worker);
  const writer = writableStreamFromWorker(worker);
  const closed = new Promise<void>((resolve) => {
    worker.addEventListener("message", (ev) => {
      if (ev.data === "WORKER_CLOSED") {
        resolve();
      }
    });
  });

  try {
    await Promise.race([
      reader.pipeTo(conn.writable),
      conn.readable.pipeTo(writer),
    ]);
  } finally {
    worker.postMessage(WORKER_STREAM_CLOSE_MESSAGE);
    await deadline(closed, WORKER_CLOSE_TIMEOUT_MS).catch(() => {});
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

  waitProcessSignal("SIGINT").then(() => {
    listener.close();
  });

  const handleConn = async (conn: Deno.Conn<Deno.NetAddr>): Promise<void> => {
    const { remoteAddr } = conn;
    const name = `${remoteAddr.hostname}:${remoteAddr.port}`;
    if (!quiet) {
      console.info(`${name} is connected`);
    }
    try {
      await processWorker(name, conn);
    } catch (err) {
      console.error(
        "Internal error occurred and Host/Denops connection is dropped",
        err,
      );
    } finally {
      try {
        conn.close();
      } catch {
        // do nothing
      }
      if (!quiet) {
        console.info(`${name} is closed`);
      }
    }
  };

  const connections = new Set<Promise<void>>();
  for await (const conn of listener) {
    const handler = handleConn(conn)
      .finally(() => connections.delete(handler));
    connections.add(handler);
  }
  await Promise.all([...connections]);
}

if (import.meta.main) {
  await main();
}
