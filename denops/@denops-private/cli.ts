import { parse } from "https://deno.land/std@0.149.0/flags/mod.ts";
import { using } from "https://deno.land/x/disposable@v1.0.2/mod.ts#^";
import { Service } from "./service.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { TraceReader, TraceWriter } from "./tracer.ts";
import { tee } from "./tee.ts";

type Opts = {
  hostname?: string;
  port?: number;
  trace?: boolean;
  quiet?: boolean;
  identity?: boolean;
};

type Host = typeof Vim | typeof Neovim;

async function detectHost(reader: Deno.Reader): Promise<Host> {
  const marks = new TextEncoder().encode('[{tf"0123456789');
  const chunk = new Uint8Array(1);
  await reader.read(chunk);
  const mark = chunk.at(0);
  if (mark && marks.includes(mark)) {
    return Vim;
  }
  return Neovim;
}

const { hostname, port, trace, quiet, identity } = parse(Deno.args) as Opts;

const listener = Deno.listen({
  hostname: hostname ?? "127.0.0.1",
  port: port ?? 32123,
});
const localAddr = listener.addr as Deno.NetAddr;

if (identity) {
  console.log(`${localAddr.hostname}:${localAddr.port}`);
}
if (!quiet) {
  console.log(
    `Listen denops clients on ${localAddr.hostname}:${localAddr.port}`,
  );
}

for await (const conn of listener) {
  const remoteAddr = conn.remoteAddr as Deno.NetAddr;
  const reader = trace ? new TraceReader(conn) : conn;
  const writer = trace ? new TraceWriter(conn) : conn;

  const [r1, r2] = tee(reader);

  // Detect host from payload
  const hostClass = await detectHost(r1);
  r1.close();

  if (!quiet) {
    console.log(
      `${remoteAddr.hostname}:${remoteAddr.port} (${hostClass.name}) is connected`,
    );
  }

  // Create host and service
  using(new hostClass(r2, writer), async (host) => {
    await using(new Service(host), async (service) => {
      await service.waitClosed();
      if (!quiet) {
        console.log(
          `${remoteAddr.hostname}:${remoteAddr.port} (${hostClass.name}) is closed`,
        );
      }
    });
  });
}
