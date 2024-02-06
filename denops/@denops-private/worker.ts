import {
  readableStreamFromWorker,
  writableStreamFromWorker,
} from "https://deno.land/x/workerio@v3.1.0/mod.ts";
import { ensure } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import { pop } from "https://deno.land/x/streamtools@v0.5.0/mod.ts";
import { usingResource } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
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
  const worker = self as unknown as Worker;
  const writer = writableStreamFromWorker(worker);
  const [reader, detector] = readableStreamFromWorker(worker).tee();

  // Detect host from payload
  const hostCtor = await detectHost(detector);

  await usingResource(new hostCtor(reader, writer), async (host) => {
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
    await usingResource(new Service(meta), async (service) => {
      await host.init(service);
      await host.call("execute", "doautocmd <nomodeline> User DenopsReady", "");
      await host.waitClosed();
    });
  });
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(
      `Internal error occurred in Worker`,
      err,
    );
  });
}
