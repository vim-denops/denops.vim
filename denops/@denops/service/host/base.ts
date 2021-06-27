import { Disposable } from "../../deps.ts";
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
   * Register invoker
   */
  register(invoker: Invoker): void;

  /**
   * Wait host close
   */
  waitClosed(): Promise<void>;
}
