import { Dispatcher, Session } from "./deps.ts";

/**
 * Context which is expanded to the local namespace (l:)
 */
export type Context = Record<string, unknown>;

/**
 * Denpos is a facade instance visible from each denops plugins.
 */
export class Denops {
  readonly name: string;
  #session: Session;

  constructor(
    name: string,
    session: Session,
  ) {
    this.name = name;
    this.#session = session;
  }

  get dispatcher(): Dispatcher {
    return this.#session.dispatcher;
  }

  set dispatcher(dispatcher: Dispatcher) {
    this.#session.dispatcher = dispatcher;
  }

  /**
   * Call an arbitrary function of Vim/Neovim and return the result
   *
   * @param fn: A function name of Vim/Neovim.
   * @param args: Arguments of the function.
   */
  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#session.call("call", fn, ...args);
  }

  /**
   * Execute an arbitrary command of Vim/Neovim under a given context.
   *
   * @param cmd: A command expression to be executed.
   * @param ctx: A context object which is expanded to the local namespace (l:)
   */
  async cmd(cmd: string, ctx: Context = {}): Promise<void> {
    await this.#session.notify("call", "denops#api#cmd", cmd, ctx);
  }

  /**
   * Evaluate an arbitrary expression of Vim/Neovim under a given context and return the result.
   *
   * @param expr: An expression to be evaluated.
   * @param ctx: A context object which is expanded to the local namespace (l:)
   */
  async eval(expr: string, ctx: Context = {}): Promise<unknown> {
    return await this.#session.call("call", "denops#api#eval", expr, ctx);
  }

  /**
   * Dispatch an arbitrary function of an arbitrary plugin and return the result.
   *
   * @param name: A plugin registration name.
   * @param fn: A function name in the API registration.
   * @param args: Arguments of the function.
   */
  async dispatch(
    name: string,
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return await this.#session.call("dispatch", name, fn, ...args);
  }
}
