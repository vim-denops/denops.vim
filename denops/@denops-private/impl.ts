import {
  BatchError,
  Context,
  Denops,
  Dispatcher,
  Meta,
} from "../@denops/mod.ts";

type Session = {
  dispatcher: Dispatcher;
  call(method: string, ...params: unknown[]): Promise<unknown>;
  notify(method: string, ...params: unknown[]): Promise<void>;
};

export class DenopsImpl implements Denops {
  readonly context: Record<string | number | symbol, unknown> = {};
  readonly name: string;
  readonly meta: Meta;
  #session: Session;

  constructor(
    name: string,
    meta: Meta,
    session: Session,
  ) {
    this.name = name;
    this.meta = meta;
    this.#session = session;
  }

  get dispatcher(): Dispatcher {
    return this.#session.dispatcher;
  }

  set dispatcher(dispatcher: Dispatcher) {
    this.#session.dispatcher = dispatcher;
  }

  redraw(force?: boolean): Promise<void> {
    // maybe we can use 'notify' here?
    return this.#session.call("redraw", force).then();
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.#session.call("call", fn, ...normArgs(args));
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<unknown[]> {
    const normCalls = calls.map(([fn, ...args]) => [fn, ...normArgs(args)]);
    const [results, errmsg] = await this.#session.call(
      "batch",
      ...normCalls,
    ) as [
      unknown[],
      string,
    ];
    if (errmsg !== "") {
      throw new BatchError(errmsg, results);
    }
    return results;
  }

  cmd(cmd: string, ctx: Context = {}): Promise<void> {
    // maybe we can use 'notify' here?
    return this.#session.call("call", "denops#api#cmd", cmd, ctx).then();
  }

  eval(expr: string, ctx: Context = {}): Promise<unknown> {
    return this.#session.call("call", "denops#api#eval", expr, ctx);
  }

  dispatch(
    name: string,
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return this.#session.call("dispatch", name, fn, ...args);
  }
}

function normArgs(args: unknown[]): unknown[] {
  const normArgs = [];
  for (const arg of args) {
    if (arg === undefined) {
      break;
    }
    normArgs.push(arg);
  }
  return normArgs;
}
