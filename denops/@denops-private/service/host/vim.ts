import { VimMessage, VimSession } from "../deps.ts";
import { Invoker, isInvokerMethod } from "./invoker.ts";
import { Host } from "./base.ts";
import { Meta } from "../../../@denops/denops.ts";

export class Vim implements Host {
  #session: VimSession;
  #meta?: Meta;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#session = new VimSession(reader, writer);
  }

  private async callForDebugBefore823080(
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    await this.#session.call(
      "denops#api#vim#call_before_823080_pre",
      fn,
      args,
    ) as string;
    await this.#session.ex("call denops#api#vim#call_before_823080_call()");
    const [ret, err] = await this.#session.expr(
      "[g:denops#api#vim#call_before_823080, v:errmsg]",
    ) as [unknown, string];
    if (err !== "") {
      throw new Error(`Failed to call '${fn}(${args.join(", ")})': ${err}`);
    }
    return ret;
  }

  private async callForDebug(fn: string, ...args: unknown[]): Promise<unknown> {
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

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    if (!this.#meta) {
      this.#meta = await this.#session.call("denops#util#meta") as Meta;
    }
    // NOTE:
    // A `call` channel command IGNORE/SILENCE any errors occured so we need workaround
    // to detect errors.
    // Vim before 8.2.3080 IGNORE errors so we need to use `ex` channel command with reading
    // `v:error` instead. However, it's cost a bit thus we only enable that when denops is
    // running on non relese mode.
    // Vim after 8.2.2081 SILENCE errors so we can detect errors by try/catch tech. The cost
    // of the tech is quite small (determined by vim-denops/denops-benchmark) thus we alreays
    // enable this workaround.
    try {
      if (this.#meta.mode !== "release" && isBefore823080(this.#meta.version)) {
        return await this.callForDebugBefore823080(fn, ...args);
      }
      return await this.callForDebug(fn, ...args);
    } finally {
      await this.#session.redraw();
    }
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<[unknown[], string]> {
    if (!this.#meta) {
      this.#meta = await this.#session.call("denops#util#meta") as Meta;
    }
    // NOTE:
    // A channel command SILENCE/IGNORE any errors occured in 'call' thus
    // we need workaround to detect errors.
    // However, such workaround would impact the performance thus we only
    // enable such workaround when 'g:denops#debug' or 'g:denops#_test' is
    // enabled.
    let call;
    if (this.#meta.mode !== "release" && isBefore823080(this.#meta.version)) {
      call = this.callForDebugBefore823080;
    } else {
      call = this.callForDebug;
    }
    const results = [];
    try {
      for (const [fn, ...args] of calls) {
        results.push(await call.call(this, fn, ...args));
      }
      return [results, ""];
    } catch (e) {
      return [results, e.toString()];
    } finally {
      await this.#session.redraw();
    }
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

function isBefore823080(version: string): boolean {
  return version.localeCompare("8.2.3080", undefined, {
    numeric: true,
    sensitivity: "base",
  }) === -1;
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
