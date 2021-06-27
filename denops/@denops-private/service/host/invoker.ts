import { Service } from "../service.ts";

export class Invoker {
  #service: Service;

  constructor(service: Service) {
    this.#service = service;
  }

  register(name: string, script: string): void {
    this.#service.register(name, script);
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
