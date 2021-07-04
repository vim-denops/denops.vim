import { flags, using } from "./deps.ts";
import { Service } from "./service.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";

const opts = flags.parse(Deno.args);

// Check opts
if (!opts.address) {
  throw new Error("No `--address` option is specified.");
}
if (!opts.mode) {
  throw new Error("No `--mode` option is specified.");
}

// Connect to the address
const address = JSON.parse(opts.address);
const conn = await Deno.connect(address);

// Create host and service
const hostClass = opts.mode === "vim" ? Vim : Neovim;
await using(new hostClass(conn, conn), async (host) => {
  const service = new Service(host);
  await service.waitClosed();
});
