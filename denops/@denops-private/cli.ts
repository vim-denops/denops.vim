import { ensure, is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import { parseArgs } from "https://deno.land/std@0.208.0/cli/mod.ts";
import { pop } from "https://deno.land/x/streamtools@v0.5.0/mod.ts";
import { usingResource } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
import { isPluginArchitectureModel, Service } from "./service.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { isMeta } from "./util.ts";

type Host = typeof Vim | typeof Neovim;

const isBatchReturn = is.TupleOf([isMeta, isPluginArchitectureModel] as const);

async function detectHost(reader: ReadableStream<Uint8Array>): Promise<Host> {
  const marks = new TextEncoder().encode('[{tf"0123456789');
  const mark = (await pop(reader))?.at(0);
  if (mark && marks.includes(mark)) {
    return Vim;
  }
  return Neovim;
}

async function handleConn(conn: Deno.Conn): Promise<void> {
  const remoteAddr = conn.remoteAddr as Deno.NetAddr;
  const reader = conn.readable;
  const writer = conn.writable;

  const [r1, r2] = reader.tee();

  // Detect host from payload
  const start = performance.now();
  const hostClass = await detectHost(r1);
  r1.cancel();
  if (!quiet) {
    console.warn(`Detecting host took ${performance.now() - start} ms`);
  }

  if (!quiet) {
    console.warn(
      `${remoteAddr.hostname}:${remoteAddr.port} (${hostClass.name}) is connected`,
    );
  }

  // Create host and service
  await usingResource(new hostClass(r2, writer), async (host) => {
    const [ret, err] = await host.batch(
      ["denops#_internal#meta#get"],
      ["eval", "g:denops#plugin_architecture_model"],
    );
    if (err) {
      throw new Error(err);
    }
    const [meta, model] = ensure(ret, isBatchReturn);
    await usingResource(new Service(host, meta, model), async (_service) => {
      await host.call("execute", "doautocmd <nomodeline> User DenopsReady");
      await host.waitClosed();
      if (!quiet) {
        console.warn(
          `${remoteAddr.hostname}:${remoteAddr.port} (${hostClass.name}) is closed`,
        );
      }
    });
  });
}

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
  console.log(`${localAddr.hostname}:${localAddr.port}`);
}
if (!quiet) {
  console.warn(
    `Listen denops clients on ${localAddr.hostname}:${localAddr.port}`,
  );
}

for await (const conn of listener) {
  handleConn(conn).catch((err) => console.error("Unexpected error", err));
}
