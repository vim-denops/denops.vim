/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "jsr:@lambdalisue/workerio@4.0.1";
import { ensure } from "jsr:@core/unknownutil@3.18.0";
import { pop } from "jsr:@lambdalisue/streamtools@1.0.0";
import type { HostConstructor } from "./host.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { Service } from "./service.ts";
import { isMeta } from "./util.ts";

const marks = new TextEncoder().encode('[{tf"0123456789');

async function detectHost(
  reader: ReadableStream<Uint8Array>,
): Promise<HostConstructor> {
  const mark = (await pop(reader))?.at(0);
  reader.cancel();
  if (mark && marks.includes(mark)) {
    return Vim;
  }
  return Neovim;
}

function formatArgs(args: unknown[]): string[] {
  return args.map((v) => {
    if (v instanceof Error) {
      return `${v.stack ?? v}`;
    } else if (typeof v === "string") {
      return v;
    }
    return JSON.stringify(v);
  });
}

async function main(): Promise<void> {
  const writer = writableStreamFromWorker(self);
  const [reader, detector] = readableStreamFromWorker(self).tee();

  // Detect host from payload
  const hostCtor = await detectHost(detector);

  await using host = new hostCtor(reader, writer);
  const meta = ensure(await host.call("denops#_internal#meta#get"), isMeta);
  // Patch console
  console.log = (...args: unknown[]) => {
    host.notify(
      "denops#_internal#echo#log",
      ...formatArgs(args),
    );
  };
  console.info = (...args: unknown[]) => {
    host.notify(
      "denops#_internal#echo#info",
      ...formatArgs(args),
    );
  };
  console.debug = meta.mode !== "debug" ? () => {} : (...args: unknown[]) => {
    host.notify(
      "denops#_internal#echo#debug",
      ...formatArgs(args),
    );
  };
  console.warn = (...args: unknown[]) => {
    host.notify(
      "denops#_internal#echo#warn",
      ...formatArgs(args),
    );
  };
  console.error = (...args: unknown[]) => {
    host.notify(
      "denops#_internal#echo#error",
      ...formatArgs(args),
    );
  };

  // Start service
  using service = new Service(meta);
  await host.init(service);
  await host.call("execute", "doautocmd <nomodeline> User DenopsReady", "");
  await host.waitClosed();
}

if (import.meta.main) {
  // Avoid denops server crash via UnhandledRejection
  globalThis.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    console.error(`Unhandled rejection:`, event.reason);
  });

  await main().catch((err) => {
    console.error(
      `Internal error occurred in Worker`,
      err,
    );
  });
}
