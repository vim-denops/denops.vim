import {
  BatchError,
  Context,
  Denops,
  Dispatcher,
  Meta,
} from "../@denops/mod.ts";
import { Service } from "./service.ts";

export class DenopsImpl implements Denops {
  readonly context: Record<string | number | symbol, unknown> = {};
  readonly name: string;
  readonly meta: Meta;
  dispatcher: Dispatcher = {};
  #service: Service;

  constructor(
    name: string,
    meta: Meta,
    service: Service,
  ) {
    this.name = name;
    this.meta = meta;
    this.#service = service;
  }

  async redraw(force?: boolean): Promise<void> {
    await this.#service.host.redraw(force);
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#service.host.call(fn, ...normArgs(args));
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<unknown[]> {
    const normCalls = calls.map(([fn, ...args]) =>
      [fn, ...normArgs(args)] as const
    );
    const [results, errmsg] = await this.#service.host.batch(
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

  async cmd(cmd: string, ctx: Context = {}): Promise<void> {
    await this.#service.host.call("denops#api#cmd", cmd, ctx);
  }

  async eval(expr: string, ctx: Context = {}): Promise<unknown> {
    return await this.#service.host.call("denops#api#eval", expr, ctx);
  }

  async dispatch(
    name: string,
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return await this.#service.dispatch(name, fn, args);
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
