import { Service } from "../service.ts";
import { Meta } from "../../../@denops/denops.ts";

export type RegisterOptions = {
  reload?: boolean;
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
      .then((r) => this.#service.call("denops#callback#call", success, r))
      .catch((e) => this.#service.call("denops#callback#call", failure, e))
      .catch((e) => {
        console.error(`${e.stack ?? e.toString()}`);
      });
    return Promise.resolve();
  }
}

export function isInvokerMethod(value: string): value is keyof Invoker {
  return value in Invoker.prototype;
}
