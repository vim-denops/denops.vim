import { parse } from "https://deno.land/std@0.127.0/flags/mod.ts";
import { using } from "https://deno.land/x/disposable@v1.0.2/mod.ts#^";
import { Service } from "./service.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { TraceReader, TraceWriter } from "./tracer.ts";

const opts = parse(Deno.args);

// Check opts
if (!opts.mode) {
  throw new Error("No `--mode` option is specified.");
}

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

  // Create host and service
  const hostClass = opts.mode === "vim" ? Vim : Neovim;
  await using(new hostClass(reader, writer), async (host) => {
    const service = new Service(host);
    await service.waitClosed();
  });

  // Allow only single client
  break;
}
