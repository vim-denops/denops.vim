import type { Disposable } from "https://deno.land/x/disposable@v1.2.0/mod.ts";
import { Invoker } from "./invoker.ts";

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
