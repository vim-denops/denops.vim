import { Dispatcher } from "./deps.ts";

/**
 * Context which is expanded to the local namespace (l:)
 */
export type Context = Record<string, unknown>;

export type Meta = {
  readonly mode: "release" | "debug" | "test";
  readonly host: "vim" | "nvim";
  readonly version: string;
  readonly platform: "windows" | "mac" | "linux";
};

/**
 * Denpos is a facade instance visible from each denops plugins.
 */
export interface Denops {
  /**
   * Denops instance name which uses to communicate with vim.
   */
  readonly name: string;

  /**
   * Environment meta information.
   */
  readonly meta: Meta;

  /**
   * User defined API name and method map which is used to dispatch API request
   */
  dispatcher: Dispatcher;

  /**
   * Call an arbitrary function of Vim/Neovim and return the result
   *
   * @param fn: A function name of Vim/Neovim.
   * @param args: Arguments of the function.
   */
  call(fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Execute an arbitrary command of Vim/Neovim under a given context.
   *
   * @param cmd: A command expression to be executed.
   * @param ctx: A context object which is expanded to the local namespace (l:)
   */
  cmd(cmd: string, ctx?: Context): Promise<void>;

  /**
   * Evaluate an arbitrary expression of Vim/Neovim under a given context and return the result.
   *
   * @param expr: An expression to be evaluated.
   * @param ctx: A context object which is expanded to the local namespace (l:)
   */
  eval(expr: string, ctx?: Context): Promise<unknown>;

  /**
   * Dispatch an arbitrary function of an arbitrary plugin and return the result.
   *
   * @param name: A plugin registration name.
   * @param fn: A function name in the API registration.
   * @param args: Arguments of the function.
   */
  dispatch(name: string, fn: string, ...args: unknown[]): Promise<unknown>;
}
