import { ensure, is } from "https://deno.land/x/unknownutil@v3.10.0/mod.ts";
import {
  BatchError,
  Context,
  Denops,
  Dispatcher,
  Meta,
} from "../../../@denops/mod.ts";
import type { Service } from "../../service.ts";

const isBatchReturn = is.TupleOf([is.Array, is.String] as const);

export class DenopsImpl implements Denops {
  readonly context: Record<string | number | symbol, unknown> = {};
  readonly name: string;
  dispatcher: Dispatcher = {};
  #service: Service;

  constructor(
    name: string,
    service: Service,
  ) {
    this.name = name;
    this.#service = service;
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

  batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<unknown[]> {
    const normCalls = calls.map(([fn, ...args]) =>
      [fn, ...normArgs(args)] as const
    );
    return this.#service.host.batch(...normCalls).then((ret) => {
      const [results, errmsg] = ensure(ret, isBatchReturn);
      if (errmsg !== "") {
        throw new BatchError(errmsg, results);
      }
      return results;
    });
  }

  cmd(cmd: string, ctx: Context = {}): Promise<void> {
    return this.#service.host.call("denops#api#cmd", cmd, ctx).then();
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
