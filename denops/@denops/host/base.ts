/**
 * Host (Vim/Neovim) which is visible from Service
 */
export interface Host {
  /**
   * Call an arbitrary function of the host and return the result.
   */
  call(fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Listen and process RPC messages forever
   */
  listen(invoker: Invoker): Promise<void>;
}

export interface Invoker {
  register(name: string, script: string): void;

  dispatch(
    name: string,
    fn: string,
    args: unknown[],
  ): Promise<unknown>;

  dispatchAsync(
    name: string,
    fn: string,
    args: unknown[],
    success: string, // Callback ID
    failure: string, // Callback ID
  ): Promise<void>;
}
