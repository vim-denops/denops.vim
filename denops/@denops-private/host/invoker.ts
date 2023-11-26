import { is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import type { Service } from "../service.ts";
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

export type ReloadOptions = {
  /**
   * The behavior of reload when the plugin is not registered yet.
   *
   * skip:    Skip reload
   * error:   Throw an error
   */
  mode?: "skip" | "error";
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
    trace: boolean,
  ): void {
    this.#service.register(name, script, meta, options, trace);
  }

  reload(
    name: string,
    meta: Meta,
    options: ReloadOptions,
    trace: boolean,
  ): void {
    this.#service.reload(name, meta, options, trace);
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
