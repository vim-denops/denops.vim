import { is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import type { Service } from "../service.ts";

export class Invoker {
  #service: Service;

  constructor(service: Service) {
    this.#service = service;
  }

  register(name: string, script: string): void {
    return this.#service.register(name, script);
  }

  reload(name: string): void {
    return this.#service.reload(name);
  }

  dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    return this.#service.dispatch(name, fn, args);
  }

  dispatchAsync(
    name: string,
    fn: string,
    args: unknown[],
    success: string, // Callback ID
    failure: string, // Callback ID
  ): Promise<void> {
    this.#service.dispatch(name, fn, args)
      .then(async (r) => {
        try {
          await this.#service.host.call("denops#callback#call", success, r);
        } catch (e) {
          console.error(`${e.stack ?? e.toString()}`);
        }
      })
      .catch(async (e) => {
        try {
          await this.#service.host.call(
            "denops#callback#call",
            failure,
            toErrorObject(e),
          );
        } catch (e) {
          console.error(`${e.stack ?? e.toString()}`);
        }
      });
    return Promise.resolve();
  }
}

export function isInvokerMethod(value: unknown): value is keyof Invoker {
  return is.String(value) && value in Invoker.prototype;
}

// https://github.com/vim-denops/denops.vim/issues/112
function toErrorObject(
  err: unknown,
): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return {
    name: typeof err,
    message: `${err}`,
  };
}
