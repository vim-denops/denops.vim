import { startServer } from "https://deno.land/x/denops@v0.1/server.ts";

await startServer({
  mode: "vim",
  debug: false,
});
