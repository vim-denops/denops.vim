import { flags } from "../deps.ts";
import { Service } from "../service.ts";
import { Neovim, Vim } from "../host/mod.ts";

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
const host = new hostClass(conn, conn);
const service = new Service(host);

// Listen forever
await host.listen(service);
