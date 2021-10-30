import { toFileUrl } from "https://deno.land/std@0.111.0/path/mod.ts";
import {
  ensureObject,
  ensureString,
} from "https://deno.land/x/unknownutil@v1.1.4/mod.ts#^";
import { isMeta, runner, worker } from "./common.ts";

// Wait startup arguments and start 'main'
worker.addEventListener("message", async (event: MessageEvent<unknown>) => {
  ensureObject(event.data);
  ensureString(event.data.name);
  ensureString(event.data.script);
  if (!isMeta(event.data.meta)) {
    throw new Error(`Invalid 'meta' is passed: ${event.data.meta}`);
  }
  const { name, script, meta } = event.data;
  try {
    const mod = await import(toFileUrl(script).href);
    await runner(name, mod, meta);
  } catch (e) {
    console.error(`Unexpected error occured in '${name}' (${script}): ${e}`);
  }
}, { once: true });
