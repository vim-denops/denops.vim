import { DispatcherFrom, Session } from "../deps.ts";
import { AbstractHost } from "./base.ts";
import { Service } from "../service.ts";

class Neovim extends AbstractHost {
  #session: Session;
  #listener: Promise<void>;

  constructor(session: Session) {
    super();
    this.#session = session;
    this.#listener = this.#session.listen();
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#session.call("nvim_call_function", fn, args);
  }

  registerService(service: Service): void {
    const dispatcher: DispatcherFrom<Service> = {
      async register(name: unknown, script: unknown): Promise<unknown> {
        if (typeof name !== "string") {
          throw new Error(`'name' in 'register()' of host must be a string`);
        }
        if (typeof script !== "string") {
          throw new Error(`'script' in 'register()' of host must be a string`);
        }
        return await service.register(name, script);
      },

      async dispatch(
        name: unknown,
        fn: unknown,
        args: unknown,
      ): Promise<unknown> {
        if (typeof name !== "string") {
          throw new Error(`'name' in 'dispatch()' of host must be a string`);
        }
        if (typeof fn !== "string") {
          throw new Error(`'fn' in 'dispatch()' of host must be a string`);
        }
        if (!Array.isArray(args)) {
          throw new Error(`'args' in 'dispatch()' of host must be an array`);
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
  const session = new Session(reader, writer);
  return new Neovim(session);
}
