import type { Disposable } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
import { is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import { Service } from "./service.ts";

/**
 * Host (Vim/Neovim) which is visible from Service
 */
export interface Host extends Disposable {
  /**
   * Redraw text and cursor on Vim but Neovim.
   */
  redraw(force?: boolean): Promise<void>;

  /**
   * Call host function and return result
   */
  call(fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Batch call host functions and return results and error
   */
  batch(
    ...calls: (readonly [string, ...unknown[]])[]
  ): Promise<readonly [unknown[], string]>;

  /**
   * Register invoker
   */
  register(invoker: Invoker): void;

  /**
   * Wait host close
   */
  waitClosed(): Promise<void>;
}

export type HostConstructor = {
  new (
    readable: ReadableStream<Uint8Array>,
    writable: WritableStream<Uint8Array>,
  ): Host;
};

export class Invoker {
  #service: Service;

  constructor(service: Service) {
    this.#service = service;
  }

  load(
    name: string,
    script: string,
  ): Promise<void> {
    return this.#service.load(name, script);
  }

  reload(
    name: string,
  ): Promise<void> {
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
    return this.#service.dispatchAsync(name, fn, args, success, failure);
  }
}

export function isInvokerMethod(value: unknown): value is keyof Invoker {
  return is.String(value) && value in Invoker.prototype;
}
