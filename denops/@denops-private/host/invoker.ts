import { is } from "https://deno.land/x/unknownutil@v3.2.0/mod.ts#^";
import type { Service } from "../service.ts";

export type RegisterOptions = {
  mode?: "reload" | "skip" | "error";
};

export type LoadOptions = {
  reload?: boolean;
  trace?: boolean;
};

export class Invoker {
  #service: Service;

  constructor(service: Service) {
    this.#service = service;
  }

  register(
    name: string,
    script: string,
    options: RegisterOptions,
    trace: boolean,
  ): void {
    this.#service.register(name, script, options, trace);
  }

  define(name: string, script: string): void {
    this.#service.define(name, script);
  }

  async load(name: string, options: LoadOptions): Promise<void> {
    await this.#service.load(name, options);
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
