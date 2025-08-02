import { delay } from "@std/async/delay";
import { useSharedServer } from "/denops-testutil/shared_server.ts";

{
  await using _server = await useSharedServer({ verbose: true });
  await delay(100);
}
