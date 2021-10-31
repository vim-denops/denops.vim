import { Service } from "../service.ts";
import type { Meta } from "../../@denops/mod.ts";

export type RegisterOptions = {
  /**
   * The behavior of register when the plugin is already registered.
   *
   * reload:  Reload the plugin
   * skip:    Skip registration
   * error:   Throw an error
   */
  mode?: "reload" | "skip" | "error";
};

export class Invoker {
  #service: Service;

  constructor(service: Service) {
    this.#service = service;
  }

  register(
    name: string,
    script: string,
    meta: Meta,
    options: RegisterOptions,
  ): void {
    this.#service.register(name, script, meta, options);
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
          await this.#service.call("denops#callback#call", success, r);
        } catch (e) {
          console.error(`${e.stack ?? e.toString()}`);
        }
      })
      .catch(async (e) => {
        try {
          await this.#service.call(
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

export function isInvokerMethod(value: string): value is keyof Invoker {
  return value in Invoker.prototype;
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
