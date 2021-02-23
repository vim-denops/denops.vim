import { VimMessage, VimSession } from "../deps.ts";
import { AbstractHost } from "./base.ts";
import { Service } from "../service.ts";

class Vim extends AbstractHost {
  #session: VimSession;
  #listener: Promise<void>;

  constructor(session: VimSession) {
    super();
    this.#session = session;
    this.#listener = this.#session.listen();
  }

  async call(func: string, ...args: unknown[]): Promise<unknown> {
    const result = await this.#session.call(func, ...args);
    // Make sure that everything is up to date after the command
    await this.#session.redraw();
    return result;
  }

  registerService(service: Service): void {
    this.#session.replaceCallback(async function (message: VimMessage) {
      const [msgid, expr] = message;
      let ok = null;
      let err = null;
      try {
        ok = await dispatch(service, expr);
      } catch (e) {
        err = e;
      }
      if (msgid !== 0) {
        await this.reply(msgid, [ok, err]);
      } else if (err !== null) {
        console.error(err);
      }
    });
  }

  waitClosed(): Promise<void> {
    return this.#listener;
  }
}

export function createVim(
  reader: Deno.Reader & Deno.Closer,
  writer: Deno.Writer,
): Vim {
  const session = new VimSession(reader, writer);
  return new Vim(session);
}

async function dispatch(service: Service, expr: unknown): Promise<unknown> {
  if (isDispatchMessage(expr)) {
    const [_, name, fn, args] = expr;
    return await service.dispatch(name, fn, args);
  } else if (isDispatchAsyncMessage(expr)) {
    const [_, name, fn, args, success, failure] = expr;
    return await service.dispatchAsync(name, fn, args, success, failure);
  } else {
    throw new Error(
      `Unexpected JSON channel message is received: ${JSON.stringify(expr)}`,
    );
  }
}

type DispatchMessage = ["dispatch", string, string, unknown[]];

type DispatchAsyncMessage = [
  "dispatchAsync",
  string,
  string,
  unknown[],
  string,
  string,
];

function isDispatchMessage(data: unknown): data is DispatchMessage {
  return (
    Array.isArray(data) &&
    data.length === 4 &&
    data[0] === "dispatch" &&
    typeof data[1] === "string" &&
    typeof data[2] === "string" &&
    Array.isArray(data[3])
  );
}

function isDispatchAsyncMessage(data: unknown): data is DispatchAsyncMessage {
  return (
    Array.isArray(data) &&
    data.length === 6 &&
    data[0] === "dispatchAsync" &&
    typeof data[1] === "string" &&
    typeof data[2] === "string" &&
    Array.isArray(data[3]) &&
    typeof data[4] === "string" &&
    typeof data[5] === "string"
  );
}
