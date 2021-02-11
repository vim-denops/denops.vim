import { startServer } from "../../../denops-deno/server.ts";

await startServer({
  mode: "vim",
  debug: true,
});
