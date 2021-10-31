import {
  Session as VimSession,
} from "https://deno.land/x/vim_channel_command@v0.7.1/mod.ts#^";
import type {
  Message as VimMessage,
} from "https://deno.land/x/vim_channel_command@v0.7.1/mod.ts#^";
import { responseTimeout } from "../defs.ts";
import { Invoker, isInvokerMethod } from "./invoker.ts";
import { Host } from "./base.ts";

export class Vim implements Host {
  #session: VimSession;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#session = new VimSession(reader, writer, undefined, {
      responseTimeout,
    });
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    const [ret, err] = await this.#session.call(
      "denops#api#vim#call",
      fn,
      args,
    ) as [
      unknown,
      string,
    ];
    if (err !== "") {
      throw new Error(`Failed to call '${fn}(${args.join(", ")})': ${err}`);
    }
    return ret;
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<[unknown[], string]> {
    return await this.#session.call("denops#api#vim#batch", calls) as [
      unknown[],
      string,
    ];
  }

  register(invoker: Invoker): void {
    this.#session.replaceCallback(async (message: VimMessage) => {
      const [msgid, expr] = message;
      let ok = null;
      let err = null;
      try {
        ok = await dispatch(invoker, expr);
      } catch (e) {
        err = e;
      }
      if (msgid !== 0) {
        await this.#session.reply(msgid, [ok, err]);
      } else if (err !== null) {
        console.error(err);
      }
    });
  }

  waitClosed(): Promise<void> {
    return this.#session.waitClosed();
  }

  dispose(): void {
    this.#session.dispose();
  }
}

async function dispatch(invoker: Invoker, expr: unknown): Promise<unknown> {
  if (isInvokeMessage(expr)) {
    const [_, method, args] = expr;
    if (!isInvokerMethod(method)) {
      throw new Error(`Method '${method}' is not defined in the invoker`);
    }
    // deno-lint-ignore no-explicit-any
    return await (invoker[method] as any)(...args);
  } else {
    throw new Error(
      `Unexpected JSON channel message is received: ${JSON.stringify(expr)}`,
    );
  }
}

type InvokeMessage = ["invoke", string, unknown[]];

function isInvokeMessage(data: unknown): data is InvokeMessage {
  return (
    Array.isArray(data) &&
    data.length === 3 &&
    data[0] === "invoke" &&
    typeof data[1] === "string" &&
    Array.isArray(data[2])
  );
}
