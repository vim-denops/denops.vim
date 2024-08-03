import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "jsr:@lambdalisue/workerio@^4.0.1";
import { deadline } from "jsr:@std/async@^1.0.1/deadline";
import { parseArgs } from "jsr:@std/cli@^1.0.1/parse-args";
import { asyncSignal } from "jsr:@milly/async-signal@^1.0.0";

const WORKER_SCRIPT = import.meta.resolve("./worker.ts");
const WORKER_CLOSE_TIMEOUT_MS = 5000;

async function processWorker(name: string, conn: Deno.Conn): Promise<void> {
  const worker = new Worker(WORKER_SCRIPT, {
    name,
    type: "module",
  });
  const reader = readableStreamFromWorker(worker);
  const writer = writableStreamFromWorker(worker);

  try {
    await Promise.race([
      reader.pipeTo(conn.writable, { preventCancel: true }),
      conn.readable.pipeTo(writer),
    ]);
  } finally {
    try {
      const closeWaiter = reader.pipeTo(new WritableStream());
      await deadline(closeWaiter, WORKER_CLOSE_TIMEOUT_MS);
    } catch {
      // `reader` already closed or deadline has passed, do nothing
    }
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
        // Already closed, do nothing
      }
      if (!quiet) {
        console.info(`${name} is closed`);
      }
    }
  };

  const connections = new Set<Promise<void>>();

  {
    using sigintTrap = asyncSignal("SIGINT");
    sigintTrap.catch(() => {
      listener.close();
    });

    for await (const conn of listener) {
      const handler = handleConn(conn)
        .finally(() => connections.delete(handler));
      connections.add(handler);
    }
  }

  // The listener is closed and waits for existing connections to terminate.
  await Promise.allSettled([...connections]);
}

if (import.meta.main) {
  await main(Deno.args);
}
