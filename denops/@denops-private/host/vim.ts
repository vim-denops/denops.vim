import { ensure } from "jsr:@core/unknownutil@^4.0.0/ensure";
import { isArray } from "jsr:@core/unknownutil@^4.0.0/is/array";
import { isLiteralOf } from "jsr:@core/unknownutil@^4.0.0/is/literal-of";
import { isString } from "jsr:@core/unknownutil@^4.0.0/is/string";
import { isTupleOf } from "jsr:@core/unknownutil@^4.0.0/is/tuple-of";
import { isUnknown } from "jsr:@core/unknownutil@^4.0.0/is/unknown";
import {
  Client,
  type Message,
  Session,
} from "jsr:@denops/vim-channel-command@^4.0.2";
import { type Host, invoke, type Service } from "../host.ts";

export class Vim implements Host {
  #session: Session;
  #client: Client;
  #service?: Service;

  constructor(
    reader: ReadableStream<Uint8Array>,
    writer: WritableStream<Uint8Array>,
  ) {
    this.#session = new Session(reader, writer);
    this.#session.onMessage = (message: Message) => {
      const [msgid, expr] = message;
      this.#dispatch(expr)
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
    if (result === "ERROR") {
      // Not sure why but Vim just returns "ERROR" when 'denops.vim' is not in 'runtimepath'.
      // This makes debugging nightmare so we throw an error with better message here.
      throw new Error(
        `Vim just returns "ERROR" for 'denops#api#vim#call()'. Check if 'denops.vim' exist in 'runtimepath' properly`,
      );
    }
    const [ret, err] = ensure(result, isCallReturn);
    if (err !== "") {
      throw new Error(`Failed to call '${fn}' in Vim: ${err}`);
    }
    return ret;
  }

  async batch(
    ...calls: (readonly [string, ...unknown[]])[]
  ): Promise<[unknown[], string]> {
    const result = await this.#client.call("denops#api#vim#batch", calls);
    if (result === "ERROR") {
      // Not sure why but Vim just returns "ERROR" when 'denops.vim' is not in 'runtimepath'.
      // This makes debugging nightmare so we throw an error with better message here.
      throw new Error(
        `Vim just returns "ERROR" for 'denops#api#vim#batch()'. Check if 'denops.vim' exist in 'runtimepath' properly`,
      );
    }
    const [ret, err] = ensure(result, isBatchReturn) as [unknown[], string];
    if (err) {
      const index = ret.length;
      const fn = calls[index][0];
      return [
        ret,
        `Failed to call '${fn}' in Vim: ${err}`,
      ];
    }
    return [ret, ""];
  }

  async notify(fn: string, ...args: unknown[]): Promise<void> {
    await this.#client.callNoReply(fn, ...args);
  }

  init(service: Service): Promise<void> {
    this.#service = service;
    this.#service.bind(this);
    return Promise.resolve();
  }

  waitClosed(): Promise<void> {
    return this.#session.wait();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    try {
      await this.#session.shutdown();
    } catch {
      // Do nothing
    }
  }

  async #dispatch(expr: unknown): Promise<unknown> {
    if (isVoidMessage(expr)) {
      // Do nothing
      return;
    } else if (isInvokeMessage(expr)) {
      if (!this.#service) {
        throw new Error("No service is registered in the host");
      }
      const [_, method, args] = expr;
      return await invoke(this.#service, method, args);
    }
    throw new Error(
      `Unexpected JSON channel message is received: ${JSON.stringify(expr)}`,
    );
  }
}

const isCallReturn = isTupleOf([isUnknown, isString] as const);

const isBatchReturn = isTupleOf([isArray, isString] as const);

const isVoidMessage = isTupleOf([isLiteralOf("void")] as const);

const isInvokeMessage = isTupleOf(
  [
    isLiteralOf("invoke"),
    isString,
    isArray,
  ] as const,
);
