import type {
  Context,
  Denops,
  Dispatcher,
  Meta,
} from "https://deno.land/x/denops_core@v5.0.0/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import { BatchError } from "https://deno.land/x/denops_core@v5.0.0/mod.ts";
import type { Service } from "./service.ts";

const isBatchReturn = is.TupleOf([is.Array, is.String] as const);

export class DenopsImpl implements Denops {
  readonly context: Record<string | number | symbol, unknown> = {};
  readonly name: string;
  dispatcher: Dispatcher = {};
  #service: Service;

  constructor(
    service: Service,
    name: string,
  ) {
    this.#service = service;
    this.name = name;
  }

  get meta(): Meta {
    return this.#service.meta;
  }

  redraw(force?: boolean): Promise<void> {
    return this.#service.host.redraw(force);
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.#service.host.call(fn, ...normArgs(args));
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<unknown[]> {
    const normCalls = calls.map(([fn, ...args]) =>
      [fn, ...normArgs(args)] as const
    );
    const result = await this.#service.host.batch(...normCalls);
    const [results, errmsg] = ensure(result, isBatchReturn);
    if (errmsg !== "") {
      throw new BatchError(errmsg, results);
    }
    return results;
  }

  async cmd(cmd: string, ctx: Context = {}): Promise<void> {
    await this.#service.host.call("denops#api#cmd", cmd, ctx);
  }

  eval(expr: string, ctx: Context = {}): Promise<unknown> {
    return this.#service.host.call("denops#api#eval", expr, ctx);
  }

  dispatch(
    name: string,
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return this.#service.dispatch(name, fn, args);
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
