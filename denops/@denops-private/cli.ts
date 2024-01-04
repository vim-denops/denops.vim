import { ensure } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import { parse } from "https://deno.land/std@0.204.0/flags/mod.ts";
import { pop } from "https://deno.land/x/streamtools@v0.5.0/mod.ts";
import { usingResource } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
import { Service } from "./service.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { isMeta } from "./util.ts";

type Host = typeof Vim | typeof Neovim;

async function detectHost(reader: ReadableStream<Uint8Array>): Promise<Host> {
  const marks = new TextEncoder().encode('[{tf"0123456789');
  const mark = (await pop(reader))?.at(0);
  reader.cancel();
  if (mark && marks.includes(mark)) {
    return Vim;
  }
  return Neovim;
}

async function handleConn(
  conn: Deno.Conn,
  { quiet }: { quiet?: boolean },
): Promise<void> {
  const remoteAddr = conn.remoteAddr as Deno.NetAddr;
  const writer = conn.writable;
  const [reader, detector] = conn.readable.tee();

  // Detect host from payload
  const hostCtor = await detectHost(detector);

  if (!quiet) {
    console.info(
      `${remoteAddr.hostname}:${remoteAddr.port} (${hostCtor.name}) is connected`,
    );
  }

  await usingResource(new hostCtor(reader, writer), async (host) => {
    const meta = ensure(await host.call("denops#_internal#meta#get"), isMeta);
    await usingResource(new Service(host, meta), async (_service) => {
      await host.call("execute", "doautocmd <nomodeline> User DenopsReady", "");
      await host.waitClosed();
      if (!quiet) {
        console.info(
          `${remoteAddr.hostname}:${remoteAddr.port} (${hostCtor.name}) is closed`,
        );
      }
    });
  });
}

async function main(): Promise<void> {
  const { hostname, port, quiet, identity } = parse(Deno.args, {
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
