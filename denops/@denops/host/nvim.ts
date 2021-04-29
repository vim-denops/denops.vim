import { Session } from "../deps.ts";
import { Host } from "./base.ts";
import { Service } from "../service.ts";
import { ensureArray, ensureString } from "../utils.ts";

class Neovim implements Host {
  #session: Session;
  #listener: Promise<void>;

  constructor(session: Session) {
    this.#session = session;
    this.#listener = this.#session.listen();
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#session.call("nvim_call_function", fn, args);
  }

  registerService(service: Service): void {
    this.#session.extendDispatcher({
      async invoke(method: unknown, args: unknown): Promise<unknown> {
        ensureString(method, "method");
        ensureArray(args, "args");
        if (!(method in service)) {
          throw new Error(`Method '${method}' is not defined in the service`);
        }
        // deno-lint-ignore no-explicit-any
        return await (service as any)[method](...args);
      },
    });
  }

  waitClosed(): Promise<void> {
    return this.#listener;
  }
}

export function createNeovim(
  reader: Deno.Reader & Deno.Closer,
  writer: Deno.Writer,
): Neovim {
  const session = new Session(reader, writer);
  return new Neovim(session);
}
