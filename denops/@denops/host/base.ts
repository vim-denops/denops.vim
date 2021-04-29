import { Service } from "../service.ts";

/**
 * Host (Vim/Neovim) interface.
 */
export interface Host {
  /**
   * Call {func} of Vim/Nevoim with given {args} and return the result
   */
  call(func: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Register service which is visible from the host through RPC.
   */
  registerService(service: Service): void;

  /**
   * Wait until the host is closed
   */
  waitClosed(): Promise<void>;
}
