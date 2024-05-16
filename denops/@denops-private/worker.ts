/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "jsr:@lambdalisue/workerio@4.0.1";
import { ensure } from "jsr:@core/unknownutil@3.18.0";
import { pop } from "jsr:@lambdalisue/streamtools@1.0.0";
import { asyncSignal } from "jsr:@milly/async-signal@^1.0.0";
import type { Meta } from "jsr:@denops/core@6.0.6";
import type { Host, HostConstructor } from "./host.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { Service } from "./service.ts";
import { isMeta } from "./util.ts";

const CONSOLE_PATCH_METHODS = [
  "log",
  "info",
  "debug",
  "warn",
  "error",
] as const satisfies (keyof typeof console)[];

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

function patchConsole(host: Host, meta: Meta): void {
  for (const name of CONSOLE_PATCH_METHODS) {
    if (name === "debug" && meta.mode !== "debug") {
      console[name] = () => {};
      continue;
    }
    const orig = console[name].bind(console);
    const fn = `denops#_internal#echo#${name}`;
    console[name] = (...args: unknown[]): void => {
      host
        .notify(fn, ...formatArgs(args))
        .catch(() => orig(...args));
    };
  }
}

async function connectHost(): Promise<void> {
  const writer = writableStreamFromWorker(self);
  const [reader, detector] = readableStreamFromWorker(self).tee();

  // Detect host from payload
  const hostCtor = await detectHost(detector);

  await using host = new hostCtor(reader, writer);
  const meta = ensure(await host.call("denops#_internal#meta#get"), isMeta);

  patchConsole(host, meta);

  // Start service
  using sigintTrap = asyncSignal("SIGINT");
  using service = new Service(meta);
  await host.init(service);
  await host.call("execute", "doautocmd <nomodeline> User DenopsReady", "");
  await Promise.race([
    host.waitClosed(),
    sigintTrap,
  ]);
}

export async function main(): Promise<void> {
  // Avoid denops server crash via UnhandledRejection
  globalThis.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    console.error(`Unhandled rejection:`, event.reason);
  });

  try {
    await connectHost();
  } catch (err) {
    console.error(
      `Internal error occurred in Worker`,
      err,
    );
  }
  self.close();
}

if (import.meta.main) {
  await main();
}
