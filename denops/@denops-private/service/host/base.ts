import { Disposable } from "../deps.ts";
import { Invoker } from "./invoker.ts";

/**
 * Host (Vim/Neovim) which is visible from Service
 */
export interface Host extends Disposable {
  /**
   * Call host function and return result
   */
  call(fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Batch call host functions and return results and error
   */
  batch(...calls: [string, ...unknown[]][]): Promise<[unknown[], string]>;

  /**
   * Register invoker
   */
  register(invoker: Invoker): void;

  /**
   * Wait host close
   */
  waitClosed(): Promise<void>;
}
