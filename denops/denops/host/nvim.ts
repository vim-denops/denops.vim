import { msgpackRpc } from "../deps.ts";
import { AbstractHost } from "./base.ts";
import { Service } from "../service.ts";

class Neovim extends AbstractHost {
  #session: msgpackRpc.Session;
  #listener: Promise<void>;

  constructor(session: msgpackRpc.Session) {
    super();
    this.#session = session;
    this.#listener = this.#session.listen();
  }

  async command(expr: string): Promise<void> {
    await this.#session.notify("nvim_command", expr);
  }

  async eval(expr: string): Promise<unknown> {
    return await this.#session.call("nvim_eval", expr);
  }

  async call(fn: string, args: unknown[]): Promise<unknown> {
    return await this.#session.call("nvim_call_function", fn, args);
  }

  registerService(service: Service): void {
    type Dispatcher = {
      [K in keyof Service]: Service[K] extends (...args: infer Args) => unknown
        ? (...args: { [K in keyof Args]: unknown }) => Promise<unknown>
        : never;
    };
    const dispatcher: Dispatcher = {
      async echo(text: unknown): Promise<unknown> {
        if (typeof text !== "string") {
          throw new Error(`'text' must be a string`);
        }
        return await service.echo(text);
      },

      async register(name: unknown, script: unknown): Promise<unknown> {
        if (typeof name !== "string") {
          throw new Error(`'name' must be a string`);
        }
        if (typeof script !== "string") {
          throw new Error(`'script' must be a string`);
        }
        return await service.register(name, script);
      },

      async dispatch(
        name: unknown,
        fn: unknown,
        args: unknown,
      ): Promise<unknown> {
        if (typeof name !== "string") {
          throw new Error(`'name' must be a string`);
        }
        if (typeof fn !== "string") {
          throw new Error(`'fn' must be a string`);
        }
        if (!Array.isArray(args)) {
          throw new Error(`'args' must be a string array`);
        }
        return await service.dispatch(name, fn, args);
      },
    };
    this.#session.extendDispatcher(dispatcher);
  }

  waitClosed(): Promise<void> {
    return this.#listener;
  }
}

export function createNeovim(
  reader: Deno.Reader & Deno.Closer,
  writer: Deno.Writer,
): Neovim {
  const session = new msgpackRpc.Session(reader, writer);
  return new Neovim(session);
}
