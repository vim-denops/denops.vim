import { startServer } from "../../../denops-deno/server.ts";

await startServer({
  mode: "neovim",
  debug: true,
});
