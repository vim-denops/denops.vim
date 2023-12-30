import { ensure, is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import {
  Client,
  Session,
} from "https://deno.land/x/messagepack_rpc@v2.0.3/mod.ts#^";
import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts#^";
import type { Denops, Meta } from "../../@denops/mod.ts";
import { DenopsImpl } from "../impl.ts";
import { patchConsole } from "./patch_console.ts";
import { traceReadableStream, traceWritableStream } from "../trace_stream.ts";
import { errorDeserializer, errorSerializer } from "../error.ts";
import { isMeta } from "../util.ts";

const worker = self as unknown as Worker & { name: string };

const isMessageData = is.ObjectOf({
  scriptUrl: is.String,
  meta: isMeta,
  trace: is.OneOf([is.Undefined, is.Boolean]),
});

function emit(denops: Denops, name: string): Promise<void> {
  return denops.cmd(`doautocmd <nomodeline> User ${name}`)
    .catch((e) => console.warn(`Failed to emit ${name}: ${e}`));
}

async function main(
  scriptUrl: string,
  meta: Meta,
  trace: boolean,
): Promise<void> {
  let reader = readableStreamFromWorker(worker);
  let writer = writableStreamFromWorker(worker);
  if (trace) {
    reader = traceReadableStream(reader, { prefix: "worker -> plugin: " });
    writer = traceWritableStream(writer, { prefix: "plugin -> worker: " });
  }
  const session = new Session(reader, writer, { errorSerializer });
  session.onMessageError = (error, message) => {
    if (error instanceof Error && error.name === "Interrupted") {
      return;
    }
    console.error(`Failed to handle message ${message}`, error);
  };
  session.start();
  const client = new Client(session, { errorDeserializer });
  // Protect the process itself from "Unhandled promises"
  // https://github.com/vim-denops/denops.vim/issues/208
  globalThis.addEventListener("unhandledrejection", (ev) => {
    let { reason } = ev;
    if (reason instanceof Error && reason.stack) {
      reason = reason.stack;
    }
    console.error(
      `Unhandled rejection is detected. Worker will be reloaded: ${reason}`,
    );
    // Reload the worker because "Unhandled promises" error occured.
    client.notify("reload");
    // Avoid process death
    ev.preventDefault();
  });
  const denops: Denops = new DenopsImpl(worker.name, meta, {
    get dispatcher() {
      return session.dispatcher;
    },
    set dispatcher(dispatcher) {
      session.dispatcher = dispatcher;
    },
    call(method: string, ...params: unknown[]): Promise<unknown> {
      return client.call(method, ...params);
    },
    notify(method: string, ...params: unknown[]): Promise<void> {
      client.notify(method, ...params);
      return Promise.resolve();
    },
  });
  try {
    const mod = await import(scriptUrl);
    await emit(denops, `DenopsSystemPluginPre:${worker.name}`);
    await mod.main(denops);
    await emit(denops, `DenopsSystemPluginPost:${worker.name}`);
    await session.wait();
  } catch (e) {
    console.error(e);
    await emit(denops, `DenopsSystemPluginFail:${worker.name}`);
    await session.shutdown();
  }
  self.close();
}

// Patch console with worker name for easy debugging
patchConsole(`(${worker.name})`);

// Wait startup arguments and start 'main'
worker.addEventListener("message", (event: MessageEvent<unknown>) => {
  const { scriptUrl, meta, trace } = ensure(event.data, isMessageData);
  main(scriptUrl, meta, trace ?? false).catch((e) => {
    console.error(
      `Unexpected error occurred in '${scriptUrl}': ${e}`,
    );
  });
}, { once: true });
