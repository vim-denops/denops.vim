import { flags } from "../deps.ts";
import { Service } from "../service.ts";
import { createVim } from "../host/vim.ts";
import { createNeovim } from "../host/nvim.ts";
import { iterPlugins, Plugin, runPlugin } from "../plugin.ts";

const options = flags.parse(Deno.args);
const mode = options.mode ?? "neovim";

// Connect to the address
const address = JSON.parse(options.address);
const conn = await Deno.connect(address);

// Create host and start communication
const createHost = mode === "vim" ? createVim : createNeovim;
const host = createHost(conn, conn);
const service = new Service(host);
host.registerService(service);

// Load plugins
for await (const plugin of iterPlugins(host)) {
  Service.register(service, plugin.name, runPlugin(host, plugin));
}

// Listen forever
await host.waitClosed();
