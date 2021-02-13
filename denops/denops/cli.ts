import { flags } from "./deps.ts";
import { Service } from "./service.ts";
import { createVim } from "./host/vim.ts";
import { createNeovim } from "./host/nvim.ts";
import { updateContext } from "./context.ts";

async function main(): Promise<void> {
  const options = flags.parse(Deno.args);
  const context = updateContext({
    mode: options.mode,
    debug: options.debug,
  });
  const createHost = context.mode === "vim" ? createVim : createNeovim;
  const host = createHost(Deno.stdin, Deno.stdout);
  const service = new Service(host);
  host.registerService(service);
  await host.waitClosed();
}

main();
