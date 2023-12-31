import type {
  Context,
  Denops,
  Dispatcher,
  Meta,
} from "https://deno.land/x/denops_core@v5.0.0/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import { BatchError } from "https://deno.land/x/denops_core@v5.0.0/mod.ts";

type Session = {
  dispatcher: Dispatcher;
  call(method: string, ...params: unknown[]): Promise<unknown>;
  notify(method: string, ...params: unknown[]): Promise<void>;
};

const isBatchReturn = is.TupleOf([is.Array, is.String] as const);

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

  async redraw(force?: boolean): Promise<void> {
    await this.#session.call("redraw", force);
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.#session.call("call", fn, ...normArgs(args));
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<unknown[]> {
    const normCalls = calls.map(([fn, ...args]) =>
      [fn, ...normArgs(args)] as const
    );
    const result = await this.#session.call(
      "batch",
      ...normCalls,
    );
    const [results, errmsg] = ensure(result, isBatchReturn);
    if (errmsg !== "") {
      throw new BatchError(errmsg, results);
    }
    return results;
  }

  async cmd(cmd: string, ctx: Context = {}): Promise<void> {
    await this.#session.call("call", "denops#api#cmd", cmd, ctx);
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
