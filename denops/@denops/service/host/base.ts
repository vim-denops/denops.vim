import { Invoker } from "./invoker.ts";

/**
 * Host (Vim/Neovim) which is visible from Service
 */
export interface Host {
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
