import { Session } from "../deps.ts";
import { Host, Invoker } from "./base.ts";
import { ensureArray, ensureString } from "../utils.ts";

export class Neovim implements Host {
  #session: Session;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#session = new Session(reader, writer);
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.#session.call("nvim_call_function", fn, args);
  }

  listen(invoker: Invoker): Promise<void> {
    this.#session.clearDispatcher();
    this.#session.extendDispatcher({
      async invoke(method: unknown, args: unknown): Promise<unknown> {
        ensureString(method, "method");
        ensureArray(args, "args");
        if (!(method in invoker)) {
          throw new Error(`Method '${method}' is not defined in the invoker`);
        }
        // deno-lint-ignore no-explicit-any
        return await (invoker as any)[method](...args);
      },
    });
    return this.#session.waitClosed();
  }
}
