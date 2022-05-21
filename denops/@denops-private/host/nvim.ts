import {
  assertArray,
  assertString,
} from "https://deno.land/x/unknownutil@v2.0.0/mod.ts#^";
import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.6/mod.ts#^";
import { responseTimeout } from "../defs.ts";
import { Invoker, isInvokerMethod } from "./invoker.ts";
import { Host } from "./base.ts";

export class Neovim implements Host {
  #session: Session;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#session = new Session(reader, writer, undefined, {
      responseTimeout,
    });
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.#session.call("nvim_call_function", fn, args);
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<[unknown[], string]> {
    const [ret, err] = await this.#session.call(
      "nvim_call_atomic",
      calls.map(([fn, ...args]) => ["nvim_call_function", [fn, args]]),
    ) as [unknown[], [number, number, string] | null];
    if (err) {
      return [ret, err[2]];
    }
    return [ret, ""];
  }

  register(invoker: Invoker): void {
    this.#session.dispatcher = {
      async invoke(method: unknown, args: unknown): Promise<unknown> {
        assertString(method);
        assertArray(args);
        if (!isInvokerMethod(method)) {
          throw new Error(`Method '${method}' is not defined in the invoker`);
        }
        // deno-lint-ignore no-explicit-any
        return await (invoker[method] as any)(...args);
      },
    };
  }

  waitClosed(): Promise<void> {
    return this.#session.waitClosed();
  }

  dispose(): void {
    this.#session.dispose();
  }
}
