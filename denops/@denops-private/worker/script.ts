import { assert, is } from "https://deno.land/x/unknownutil@v3.10.0/mod.ts#^";
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

const worker = self as unknown as Worker & { name: string };

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
    await denops.cmd(
      `doautocmd <nomodeline> User DenopsSystemPluginPre:${worker.name}`,
    )
      .catch((e) =>
        console.warn(
          `Failed to emit DenopsSystemPluginPre:${worker.name}: ${e}`,
        )
      );
    await mod.main(denops);
    await denops.cmd(
      `doautocmd <nomodeline> User DenopsSystemPluginPost:${worker.name}`,
    )
      .catch((e) =>
        console.warn(
          `Failed to emit DenopsSystemPluginPost:${worker.name}: ${e}`,
        )
      );
    await session.wait();
  } catch (e) {
    console.error(e);
    await denops.cmd(
      `doautocmd <nomodeline> User DenopsSystemPluginFail:${worker.name}`,
    )
      .catch((e) =>
        console.warn(
          `Failed to emit DenopsSystemPluginFail:${worker.name}: ${e}`,
        )
      );
    await session.shutdown();
  }
  self.close();
}

function isMeta(v: unknown): v is Meta {
  if (!is.Record(v)) {
    return false;
  }
  if (!is.String(v.mode) || !["release", "debug", "test"].includes(v.mode)) {
    return false;
  }
  if (!is.String(v.host) || !["vim", "nvim"].includes(v.host)) {
    return false;
  }
  if (!is.String(v.version)) {
    return false;
  }
  if (
    !is.String(v.platform) || !["windows", "mac", "linux"].includes(v.platform)
  ) {
    return false;
  }
  return true;
}

// Patch console with worker name for easy debugging
patchConsole(`(${worker.name})`);

// Wait startup arguments and start 'main'
worker.addEventListener("message", (event: MessageEvent<unknown>) => {
  assert(event.data, is.Record, {
    message: `event.data '${event.data}' must be Record`,
  });
  assert(event.data.scriptUrl, is.String, {
    message: `event.data.scriptUrl '${event.data.scriptUrl}' must be String`,
  });
  assert(event.data.meta, isMeta, {
    message: `event.data.meta '${event.data.meta}' must be Meta`,
  });
  assert(event.data.trace, is.OneOf([is.Undefined, is.Boolean]), {
    message:
      `event.data.trace '${event.data.trace}' must be undefined or boolean`,
  });
  const { scriptUrl, meta, trace } = event.data;
  main(scriptUrl, meta, trace ?? false).catch((e) => {
    console.error(
      `Unexpected error occurred in '${scriptUrl}': ${e}`,
    );
  });
}, { once: true });
