/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "jsr:@lambdalisue/workerio@4.0.0";
import { ensure } from "jsr:@core/unknownutil@3.18.1";
import { pop } from "jsr:@lambdalisue/streamtools@1.0.0";
import type { Meta } from "jsr:@denops/core@6.1.0";
import type { Host, HostConstructor } from "./host.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { waitProcessSignal } from "./process.ts";
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

function patchConsole(host: Host, meta: Meta): void {
  type Method = (typeof methods)[number];
  const methods = [
    "log",
    "info",
    "debug",
    "warn",
    "error",
  ] as const satisfies (keyof typeof console)[];

  const wrap = Object.fromEntries(
    methods.map((name) => {
      const orig = console[name].bind(console);
      const wrapper = (fn: string) => {
        return (...args: unknown[]): void => {
          host
            .notify(fn, ...formatArgs(args))
            .catch(() => orig(...args));
        };
      };
      return [name, wrapper] as const;
    }),
  ) as Record<Method, (fn: string) => (...args: unknown[]) => void>;

  console.log = wrap.log("denops#_internal#echo#log");
  console.info = wrap.info("denops#_internal#echo#info");
  console.debug = meta.mode !== "debug"
    ? () => {}
    : wrap.debug("denops#_internal#echo#debug");
  console.warn = wrap.warn("denops#_internal#echo#warn");
  console.error = wrap.error("denops#_internal#echo#error");
}

async function main(): Promise<void> {
  const worker = self as unknown as Worker;
  const writer = writableStreamFromWorker(worker);
  const [reader, detector] = readableStreamFromWorker(worker).tee();

  // Detect host from payload
  const hostCtor = await detectHost(detector);

  await using host = new hostCtor(reader, writer);
  const meta = ensure(await host.call("denops#_internal#meta#get"), isMeta);

  patchConsole(host, meta);

  // Start service
  await using service = new Service(meta);
  await host.init(service);
  await host.call("execute", "doautocmd <nomodeline> User DenopsReady", "");
  await Promise.race([
    host.waitClosed(),
    service.waitClosed(),
    waitProcessSignal("SIGINT"),
  ]);
}

if (import.meta.main) {
  // Avoid denops server crash via UnhandledRejection
  globalThis.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    console.error("Unhandled rejection:", event.reason);
  });

  try {
    await main();
  } catch (err) {
    console.error("Internal error occurred in Worker", err);
  } finally {
    self.postMessage("WORKER_CLOSED");
    self.close();
  }
}
