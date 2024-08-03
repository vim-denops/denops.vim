import { delay } from "jsr:@std/async@^1.0.1/delay";
import { useSharedServer } from "/denops-testutil/shared_server.ts";

{
  await using _server = await useSharedServer();
  await delay(100);
}
