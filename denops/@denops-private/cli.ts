import { parse } from "https://deno.land/std@0.140.0/flags/mod.ts";
import { using } from "https://deno.land/x/disposable@v1.0.2/mod.ts#^";
import { Service } from "./service.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { TraceReader, TraceWriter } from "./tracer.ts";
import { tee } from "./tee.ts";

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

const opts = parse(Deno.args);

const listener = Deno.listen({
  hostname: "127.0.0.1",
  port: 0, // Automatically select free port
});

// Let host know the address
const addr = listener.addr as Deno.NetAddr;
console.log(`${addr.hostname}:${addr.port}`);

for await (const conn of listener) {
  const reader = opts.trace ? new TraceReader(conn) : conn;
  const writer = opts.trace ? new TraceWriter(conn) : conn;

  const [r1, r2] = tee(reader);

  // Detect host from payload
  const hostClass = await detectHost(r1);

  // Create host and service
  await using(new hostClass(reader, writer), async (host) => {
    const service = new Service(host);
    await service.waitClosed();
  });

  // Allow only single client
  break;
}
