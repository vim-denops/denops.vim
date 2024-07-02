import { delay } from "jsr:@std/async@0.224.0/delay";
import { useSharedServer } from "./shared_server.ts";

{
  await using _server = await useSharedServer();
  await delay(100);
}
