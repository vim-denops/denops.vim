import { DispatcherFrom, Session } from "./deps.ts";
import { Service } from "./service.ts";
import { ensureArray, ensureRecord, ensureString } from "./utils.ts";

type Context = Record<string, unknown>;

/**
 * Plugin API which is visible from each denops plugins through msgpack-rpc
 */
interface PluginApi {
  /**
   * Dispatch an arbitrary function of an arbitrary plugin and return the result.
   *
   * @param name: A plugin name
   * @param fn: A function name
   * @param args: Arguments
   */
  dispatch(name: string, fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Call an arbitrary function of the host and return the result.
   *
   * @param fn: A function name
   * @param args: Arguments
   */
  call(fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Execute an arbitrary command of Vim/Neovim under a given context.
   *
   * @param cmd: A command expression to be executed.
   * @param ctx: A context object which is expanded to the local namespace (l:)
   */
  cmd(cmd: string, ctx: Context): Promise<void>;

  /**
   * Evaluate an arbitrary expression of Vim/Neovim under a given context and return the result.
   *
   * @param expr: An expression to be evaluated.
   * @param ctx: A context object which is expanded to the local namespace (l:)
   */
  eval(expr: string, ctx: Context): Promise<unknown>;
}

/**
 * An instance of denops plugin
 */
export class Plugin {
  #session: Session;
  #service: Service;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
    service: Service,
  ) {
    const dispatcher: DispatcherFrom<PluginApi> = {
      dispatch: async (name, fn, ...args) => {
        ensureString(name, "name");
        ensureString(fn, "fn");
        ensureArray(args, "args");
        return await this.#service.dispatch(name, fn, args);
      },

      call: async (fn, ...args) => {
        ensureString(fn, "fn");
        ensureArray(args, "args");
        return await this.#service.host.call(fn, ...args);
      },

      cmd: async (cmd: unknown, ctx: unknown): Promise<unknown> => {
        ensureString(cmd, "cmd");
        ensureRecord(ctx, "ctx");
        return await this.#service.host.cmd(cmd, ctx);
      },

      eval: async (expr: unknown, ctx: unknown): Promise<unknown> => {
        ensureString(expr, "expr");
        ensureRecord(ctx, "ctx");
        return await this.#service.host.eval(expr, ctx);
      },
    };
    this.#service = service;
    this.#session = new Session(reader, writer, dispatcher);
    this.#session.listen()
      .then()
      .catch((e: Error) => {
        console.error("Plugin server is closed with error:", e);
      });
  }

  /**
   * Call an arbitrary function of the host and return the result.
   */
  async call(
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return await this.#session.call(fn, ...args);
  }
}
