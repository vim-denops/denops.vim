import { VimMessage, VimSession } from "../deps.ts";
import { Host } from "./base.ts";
import { Service } from "../service.ts";

class Vim implements Host {
  #session: VimSession;
  #listener: Promise<void>;

  constructor(session: VimSession) {
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
  if (isInvokeMessage(expr)) {
    const [_, method, args] = expr;
    if (!(method in service)) {
      throw new Error(`Method '${method}' is not defined in the service`);
    }
    // deno-lint-ignore no-explicit-any
    return await (service as any)[method](...args);
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
