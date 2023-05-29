import {
  assertObject,
  assertString,
  isObject,
  isString,
} from "https://deno.land/x/unknownutil@v2.1.1/mod.ts#^";
import {
  Client,
  Session,
} from "https://deno.land/x/messagepack_rpc@v2.0.0/mod.ts#^";
import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts#^";
import type { Denops, Meta } from "../../@denops/mod.ts";
import { DenopsImpl } from "../impl.ts";
import { patchConsole } from "./patch_console.ts";
import { errorDeserializer, errorSerializer } from "../error.ts";

const worker = self as unknown as Worker & { name: string };

async function main(
  scriptUrl: string,
  meta: Meta,
): Promise<void> {
  const session = new Session(
    readableStreamFromWorker(worker),
    writableStreamFromWorker(worker),
    { errorSerializer },
  );
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
    // Import module with fragment so that reload works properly
    // https://github.com/vim-denops/denops.vim/issues/227
    const mod = await import(`${scriptUrl}#${performance.now()}`);
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
  if (!isObject(v)) {
    return false;
  }
  if (!isString(v.mode) || !["release", "debug", "test"].includes(v.mode)) {
    return false;
  }
  if (!isString(v.host) || !["vim", "nvim"].includes(v.host)) {
    return false;
  }
  if (!isString(v.version)) {
    return false;
  }
  if (
    !isString(v.platform) || !["windows", "mac", "linux"].includes(v.platform)
  ) {
    return false;
  }
  return true;
}

// Patch console with worker name for easy debugging
patchConsole(`(${worker.name})`);

// Wait startup arguments and start 'main'
worker.addEventListener("message", (event: MessageEvent<unknown>) => {
  assertObject(event.data);
  assertString(event.data.scriptUrl);
  if (!isMeta(event.data.meta)) {
    throw new Error(`Invalid 'meta' is passed: ${event.data.meta}`);
  }
  const { scriptUrl, meta } = event.data;
  main(scriptUrl, meta).catch((e) => {
    console.error(
      `Unexpected error occurred in '${scriptUrl}': ${e}`,
    );
  });
}, { once: true });
