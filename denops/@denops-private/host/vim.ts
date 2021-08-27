import { Lock, VimMessage, VimSession } from "../deps.ts";
import { responseTimeout } from "../defs.ts";
import { Invoker, isInvokerMethod } from "./invoker.ts";
import { Host } from "./base.ts";

export class Vim implements Host {
  #session: VimSession;
  #isWorkaroundRequired?: boolean;
  #callBefore823081Lock: Lock;
  #batchBefore823081Lock: Lock;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#session = new VimSession(reader, writer, undefined, {
      responseTimeout,
    });
    this.#callBefore823081Lock = new Lock();
    this.#batchBefore823081Lock = new Lock();
  }

  private async isWorkaroundRequired(): Promise<boolean> {
    if (this.#isWorkaroundRequired == undefined) {
      const patched = await this.#session.call("has", "patch-8.2.3081");
      const enabled = await this.#session.expr(
        "g:denops#enable_workaround_vim_before_8_2_3081",
      );
      this.#isWorkaroundRequired = !patched && !!enabled;
    }
    return this.#isWorkaroundRequired;
  }

  private async callBefore823081(
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    let result: unknown;
    await this.#callBefore823081Lock.with(async () => {
      await this.#session.call(
        "denops#api#vim#call_before_823081_pre",
        fn,
        args,
      ) as string;
      await this.#session.ex("call denops#api#vim#call_before_823081_call()");
      const [ret, err] = await this.#session.expr(
        "[g:denops#api#vim#call_before_823081, v:errmsg]",
      ) as [unknown, string];
      if (err !== "") {
        throw new Error(`Failed to call '${fn}(${args.join(", ")})': ${err}`);
      }
      result = ret;
    });
    return result;
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    // Vim before 8.2.3081 IGNOREs any errors in `call` operation
    // thus we need to use `ex` operation with `v:error` instead
    // to detect errors. However, that workaround break interactive
    // features (such as `input()`) so this workaround is disabled
    // unless users set a corresponding option.
    // https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
    if (await this.isWorkaroundRequired()) {
      return await this.callBefore823081(fn, ...args);
    }
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

  private async batchBefore823081(
    ...calls: [string, ...unknown[]][]
  ): Promise<[unknown[], string]> {
    let result: [unknown[], string] = [[], ""];
    await this.#batchBefore823081Lock.with(async () => {
      await this.#session.call(
        "denops#api#vim#batch_before_823081_pre",
        calls,
      ) as string;
      await this.#session.ex("call denops#api#vim#batch_before_823081_call()");
      result = await this.#session.expr(
        "[g:denops#api#vim#batch_before_823081, v:errmsg]",
      ) as [unknown[], string];
    });
    return result;
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<[unknown[], string]> {
    // Vim before 8.2.3081 IGNOREs any errors in `call` operation
    // thus we need to use `ex` operation with `v:error` instead
    // to detect errors. However, that workaround break interactive
    // features (such as `input()`) so this workaround is disabled
    // unless users set a corresponding option.
    // https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
    if (await this.isWorkaroundRequired()) {
      return this.batchBefore823081(...calls);
    }
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
