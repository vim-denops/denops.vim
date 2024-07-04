import { delay } from "jsr:@std/async@0.224.0/delay";
import { useSharedServer } from "/denops-testutil/shared_server.ts";

{
  await using _server = await useSharedServer({ verbose: true });
  await delay(100);
}
