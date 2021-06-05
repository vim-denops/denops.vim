import {
  Dispatcher,
  DispatcherFrom,
  Session,
  WorkerReader,
  WorkerWriter,
} from "./deps.ts";
import { test, TestDefinition } from "./test/tester.ts";

/**
 * Context which is expanded to the local namespace (l:)
 */
export type Context = Record<string, unknown>;

/**
 * Denpos is a facade instance visible from each denops plugins.
 *
 * Plugins use the denops instance to
 *
 * 1. Communicate with other plugins
 * 2. Communicate with the host (Vim/Neovim)
 * 3. Register them msgpack-rpc APIs
 *
 * The instance is thread-local singleton. Plugins need to refer
 * the instance through `Denops.get()` static method.
 *
 * Note that plugins should NOT use the instance directly.
 * Use it through `denops_std` module instead.
 */
export class Denops {
  private static instance?: Denops;

  #name: string;
  #session: Session;

  constructor(
    name: string,
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#name = name;
    this.#session = new Session(reader, writer);
    this.#session.listen().catch((e) => {
      if (e.name === "Interrupted") {
        return;
      }
      console.error(`Unexpected error occurred in '${name}'`, e);
    });
  }

  /**
   * Get thread-local denops instance.
   */
  static get(): Denops {
    if (!Denops.instance) {
      // deno-lint-ignore no-explicit-any
      const worker = self as any;
      const reader = new WorkerReader(worker);
      const writer = new WorkerWriter(worker);
      Denops.instance = new Denops(worker.name, reader, writer);
    }
    return Denops.instance;
  }

  /**
   * Start denops mainloop for the plugin.
   *
   * @param main: An initialization function of the mainloop.
   */
  static start(init: (denops: Denops) => Promise<void> | void): void {
    const denops = Denops.get();
    const runner = async () => {
      try {
        await init(denops);
      } catch (e) {
        console.error(`Unexpected error occurred in '${denops.name}'`, e);
      }
    };
    runner();
  }

  /**
   * Register a test which will berun when `deno test` is used on the command line
   * and the containing module looks like a test module.
   *
   * `fn` receive `denops` instance which communicate with real Vim/Neovim.
   *
   * To use this function, developer must provides the following environment variables:
   *
   * DENOPS_PATH      - A path to `denops.vim` for adding to Vim's `runtimepath`
   * DENOPS_TEST_VIM  - An executable of Vim
   * DENOPS_TEST_NVIM - An executable of Neovim
   *
   * Otherwise tests using this static method will be ignored.
   */
  static test(t: TestDefinition): void;
  /**
   * Register a test which will berun when `deno test` is used on the command line
   * and the containing module looks like a test module.
   *
   * `fn` receive `denops` instance which communicate with real Vim/Neovim.
   *
   * To use this function, developer must provides the following environment variables:
   *
   * DENOPS_PATH      - A path to `denops.vim` for adding to Vim's `runtimepath`
   * DENOPS_TEST_VIM  - An executable of Vim
   * DENOPS_TEST_NVIM - An executable of Neovim
   *
   * Otherwise tests using this static method will be ignored.
   */
  static test(
    mode: TestDefinition["mode"],
    name: TestDefinition["name"],
    fn: TestDefinition["fn"],
  ): void;
  // deno-lint-ignore no-explicit-any
  static test(t: any, name?: any, fn?: any): void {
    if (typeof t === "string" && typeof name === "string" && fn != undefined) {
      test({
        // deno-lint-ignore no-explicit-any
        mode: t as any,
        name,
        fn,
      });
    } else if (typeof t === "object") {
      // deno-lint-ignore no-explicit-any
      test(t as any);
    }
  }

  /**
   * Plugin name
   */
  get name(): string {
    return this.#name;
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
    await this.#session.call("call", "denops#api#cmd", cmd, ctx);
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
   * Extend dispatcher of the internal msgpack_rpc session
   *
   * @param dispatcher: An object which key and value become API function name and callback respectively.
   */
  extendDispatcher(dispatcher: Dispatcher): void {
    this.#session.extendDispatcher(dispatcher);
  }

  /**
   * Clear dispatcher of the internal msgpack_rpc session
   */
  clearDispatcher(): void {
    this.#session.clearDispatcher();
  }
}

// Re-export
export type { Dispatcher, DispatcherFrom };
