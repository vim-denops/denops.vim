import { ensure, is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import {
  Client,
  Message,
  Session,
} from "https://deno.land/x/vim_channel_command@v2.0.0/mod.ts";
import { Invoker, isInvokerMethod } from "./invoker.ts";
import { Host } from "./base.ts";

const isCallReturn = is.TupleOf([is.Unknown, is.String] as const);

const isBatchReturn = is.TupleOf([is.Array, is.String] as const);

const isInvokeMessage = is.TupleOf(
  [
    is.LiteralOf("invoke"),
    is.String,
    is.Array,
  ] as const,
);

export class Vim implements Host {
  #session: Session;
  #client: Client;

  constructor(
    reader: ReadableStream<Uint8Array>,
    writer: WritableStream<Uint8Array>,
  ) {
    this.#session = new Session(reader, writer);
    this.#session.start();
    this.#client = new Client(this.#session);
  }

  redraw(force?: boolean): Promise<void> {
    this.#client.redraw(force);
    return Promise.resolve();
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    const result = await this.#client.call(
      "denops#api#vim#call",
      fn,
      args,
    );
    const [ret, err] = ensure(result, isCallReturn);
    if (err !== "") {
      throw new Error(`Failed to call '${fn}(${args.join(", ")})': ${err}`);
    }
    return ret;
  }

  async batch(
    ...calls: (readonly [string, ...unknown[]])[]
  ): Promise<readonly [unknown[], string]> {
    const result = await this.#client.call("denops#api#vim#batch", calls);
    return ensure(result, isBatchReturn);
  }

  register(invoker: Invoker): void {
    this.#session.onMessage = (message: Message) => {
      const [msgid, expr] = message;
      dispatch(invoker, expr)
        .then((result) => [result, null] as const)
        .catch((error) => [null, error] as const)
        .then(([result, error]) => {
          if (msgid) {
            this.#client.reply(msgid, [result, error]);
          } else if (error !== null) {
            console.error(error);
          }
        });
    };
  }

  waitClosed(): Promise<void> {
    return this.#session.wait();
  }

  async dispose(): Promise<void> {
    try {
      await this.#session.shutdown();
    } catch {
      // Do nothing
    }
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
