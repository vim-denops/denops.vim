import { context } from "../context.ts";
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
   * Output string representation of params on the host.
   *
   * This does nothing if debug mode of the denops is not enabled by users.
   */
  debug(...params: unknown[]): Promise<void>;

  /**
   * Output string representation of params on the host as an info.
   */
  info(...params: unknown[]): Promise<void>;

  /**
   * Output string representation of params on the host as an error.
   */
  error(...params: unknown[]): Promise<void>;

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

  async debug(...params: unknown[]): Promise<void> {
    if (!context.debug) {
      return;
    }
    await this.call("denops#debug", params.map(ensureReadable));
  }

  async info(...params: unknown[]): Promise<void> {
    await this.call("denops#info", params.map(ensureReadable));
  }

  async error(...params: unknown[]): Promise<void> {
    await this.call("denops#error", params.map(ensureReadable));
  }
}

function ensureReadable(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}
