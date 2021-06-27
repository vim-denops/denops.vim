import {
  ensureObject,
  ensureString,
  Session,
  using,
  WorkerReader,
  WorkerWriter,
} from "../deps.ts";
import { Denops } from "../../../@denops/denops.ts";

// deno-lint-ignore no-explicit-any
const worker = self as any as Worker;

async function main(name: string, script: string): Promise<void> {
  const reader = new WorkerReader(worker);
  const writer = new WorkerWriter(worker);
  const mod = await import(script);
  await using(
    new Session(reader, writer, {}, {
      errorCallback(e) {
        if (e.name === "Interrupted") {
          return;
        }
        console.error(`Unexpected error occurred in '${name}'`, e);
      },
    }),
    async (session) => {
      const denops = new Denops(name, session);
      await mod.main(denops);
      await session.waitClosed();
    },
  );
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
