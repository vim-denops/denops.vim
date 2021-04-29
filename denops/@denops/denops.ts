import {
  Dispatcher,
  DispatcherFrom,
  Session,
  WorkerReader,
  WorkerWriter,
} from "./deps.ts";

export type Context = Record<string, unknown>;

export class Denops {
  private static instance?: Denops;

  #name: string;
  #session: Session;

  private constructor(
    name: string,
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
  ) {
    this.#name = name;
    this.#session = new Session(reader, writer);
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
   * Start main event-loop of the plugin
   */
  static start(init: (denops: Denops) => Promise<void> | void): void {
    const denops = Denops.get();
    const waiter = Promise.all([denops.#session.listen(), init(denops)]);
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
    fn: string,
    args: unknown[]
  ): Promise<unknown> {
    return await this.#session.call("dispatch", name, fn, ...args);
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#session.call("call", fn, ...args);
  }

  async cmd(cmd: string, ctx: Context = {}): Promise<void> {
    await this.#session.call("call", "denops#api#cmd", cmd, ctx);
  }

  async eval(expr: string, ctx: Context = {}): Promise<unknown> {
    return await this.#session.call("call", "denops#api#eval", expr, ctx);
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
