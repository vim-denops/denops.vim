import { Service } from "../service.ts";

type Context = Record<string, unknown>;

/**
 * Host (Vim/Neovim) interface.
 */
export interface Host {
  /**
   * Call {func} of Vim/Nevoim with given {args} and return the result
   */
  call(func: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Execute {cmd} of Vim/Neovim under the {context}
   */
  cmd(cmd: string, context: Context): Promise<void>;

  /**
   * Evaluate {expr} of Vim/Neovim under the {context} and return result
   */
  eval(expr: string, context: Context): Promise<unknown>;

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
  abstract call(func: string, ...args: unknown[]): Promise<unknown>;
  abstract registerService(sservice: Service): void;
  abstract waitClosed(): Promise<void>;

  async cmd(cmd: string, context: Context): Promise<void> {
    await this.call("denops#api#cmd", cmd, context);
  }

  async eval(expr: string, context: Context): Promise<unknown> {
    return await this.call("denops#api#eval", expr, context);
  }
}
