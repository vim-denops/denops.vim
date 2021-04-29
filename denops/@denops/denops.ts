import {
  Dispatcher,
  DispatcherFrom,
  Session,
  WorkerReader,
  WorkerWriter,
} from "./deps.ts";

/**
 * Denops provides API to access plugin host (Vim/Neovim)
 */
export type Context = Record<string, unknown>;

export class Denops {
  private static instance?: Denops;

  #name: string;
  #session: Session;

  private constructor(
    name: string,
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
    dispatcher: Dispatcher = {},
  ) {
    this.#name = name;
    this.#session = new Session(reader, writer, dispatcher);
  }

  /**
   * Get thread-local denops instance
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
   * Start main event-loop of the plugin
   */
  static start(main: (denops: Denops) => Promise<void>): void {
    const denops = Denops.get();
    const waiter = Promise.all([denops.#session.listen(), main(denops)]);
    waiter.catch((e) => {
      console.error(`Unexpected error occurred in '${denops.name}'`, e);
    });
  }

  /**
   * Plugin name
   */
  get name(): string {
    return this.#name;
  }

  async dispatch(
    name: string,
    method: string,
    params: unknown[],
  ): Promise<unknown> {
    return await this.#session.call("dispatch", name, method, params);
  }

  async call(func: string, ...args: unknown[]): Promise<unknown> {
    return await this.#session.call("call", func, ...args);
  }

  async cmd(cmd: string, context: Context = {}): Promise<void> {
    await this.#session.call("cmd", cmd, context);
  }

  async eval(expr: string, context: Context = {}): Promise<unknown> {
    return await this.#session.call("eval", expr, context);
  }

  /**
   * Extend dispatcher of the internal msgpack_rpc session
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
