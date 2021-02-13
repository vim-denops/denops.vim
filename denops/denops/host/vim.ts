import { vimChannelCommand } from "../deps.ts";
import { AbstractHost } from "./base.ts";
import { Service } from "../service.ts";

class Vim extends AbstractHost {
  #session: vimChannelCommand.Session;
  #listener: Promise<void>;

  constructor(session: vimChannelCommand.Session) {
    super();
    this.#session = session;
    this.#listener = this.#session.listen();
  }

  async command(expr: string): Promise<void> {
    await this.#session.ex(expr);
  }

  async eval(expr: string): Promise<unknown> {
    return await this.#session.expr(expr);
  }

  async call(fn: string, args: unknown[]): Promise<unknown> {
    return await this.#session.call(fn, ...args);
  }

  registerService(service: Service): void {
    this.#session.replaceCallback(async function (
      message: vimChannelCommand.Message,
    ) {
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
  const session = new vimChannelCommand.Session(reader, writer);
  return new Vim(session);
}

async function dispatch(service: Service, expr: unknown): Promise<unknown> {
  if (isEchoMessage(expr)) {
    const [_, text] = expr;
    return await service.echo(text);
  } else if (isRegisterMessage(expr)) {
    const [_, name, script] = expr;
    return await service.register(name, script);
  } else if (isDispatchMessage(expr)) {
    const [_, name, fn, args] = expr;
    return await service.dispatch(name, fn, args);
  } else {
    throw new Error(
      `Unexpected JSON channel message is received: ${JSON.stringify(expr)}`,
    );
  }
}

type EchoMessage = ["echo", string];

type RegisterMessage = ["register", string, string];

type DispatchMessage = ["dispatch", string, string, unknown[]];

function isEchoMessage(data: unknown): data is EchoMessage {
  return (
    Array.isArray(data) &&
    data.length === 2 &&
    data[0] === "echo" &&
    typeof data[1] === "string"
  );
}

function isRegisterMessage(data: unknown): data is RegisterMessage {
  return (
    Array.isArray(data) &&
    data.length === 3 &&
    data[0] === "register" &&
    typeof data[1] === "string" &&
    typeof data[2] === "string"
  );
}

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
