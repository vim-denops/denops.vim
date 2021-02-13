import { Service } from "../service.ts";

/**
 * A Host (Vim/Neovim) interface.
 */
export interface Host {
  /**
   * Execute a command (expr) on the host.
   */
  command(expr: string): Promise<void>;

  /**
   * Evaluate an expression (expr) on the host and return the result.
   */
  eval(expr: string): Promise<unknown>;

  /**
   * Call a function on the host and return the result.
   */
  call(fn: string, args: unknown[]): Promise<unknown>;

  /**
   * Echo text on the host.
   */
  echo(text: string): Promise<void>;

  /**
   * Echo text on the host.
   */
  echomsg(text: string): Promise<void>;

  /**
   * Register service which is visible from the host through RPC.
   */
  registerService(service: Service): void;

  /**
   * Wait until the host is closed
   */
  waitClosed(): Promise<void>;
}

export abstract class AbstractHost implements Host {
  abstract command(expr: string): Promise<void>;
  abstract eval(expr: string): Promise<unknown>;
  abstract call(fn: string, args: unknown[]): Promise<unknown>;
  abstract registerService(sservice: Service): void;
  abstract waitClosed(): Promise<void>;

  async echo(text: string): Promise<void> {
    await this.call("denops#api#echo", [text]);
  }

  async echomsg(text: string): Promise<void> {
    await this.call("denops#api#echomsg", [text]);
  }
}
