/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "@lambdalisue/workerio";
import { ensure } from "@core/unknownutil/ensure";
import { pop } from "@core/streamutil";
import { asyncSignal } from "@milly/async-signal";
import type { Meta } from "@denops/core";
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

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  } else if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  } else if (value instanceof Set) {
    return [...value.values()];
  }
  return value;
}

function formatArgs(args: unknown[]): string[] {
  return args.map((v) => {
    if (v instanceof Error) {
      return `${v.stack ?? v}`;
    } else if (typeof v === "string") {
      return v;
    }
    return JSON.stringify(v, replacer);
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
  await using service = new Service(meta);
  await host.init(service);
  await host.call("denops#_internal#event#emit", "DenopsSystemReady");
  await Promise.race([
    service.waitClosed(),
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
