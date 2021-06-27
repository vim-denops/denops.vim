import {
  ensureObject,
  ensureString,
  WorkerReader,
  WorkerWriter,
} from "../../deps.ts";
import { Denops } from "../../denops.ts";

// deno-lint-ignore no-explicit-any
const worker = self as any as Worker;

async function main(name: string, script: string): Promise<void> {
  const reader = new WorkerReader(worker);
  const writer = new WorkerWriter(worker);
  const mod = await import(script);
  const denops = new Denops(name, reader, writer);
  await mod.main(denops);
  await denops.waitClosed();
  worker.terminate();
}

// Wait startup arguments and start 'main'
worker.addEventListener("message", (event: MessageEvent<unknown>) => {
  ensureObject(event.data);
  ensureString(event.data.name);
  ensureString(event.data.script);
  const { name, script } = event.data;
  main(name, script).catch((e) => {
    console.error(`Unexpected error occured in '${name}' (${script}): ${e}`);
  });
}, { once: true });
