import type {
  Context,
  Denops,
  Dispatcher,
  Meta,
} from "https://deno.land/x/denops_core@v5.0.0/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";
import { BatchError } from "https://deno.land/x/denops_core@v5.0.0/mod.ts";
import type { Host as HostOrigin } from "./host.ts";
import type { Service as ServiceOrigin } from "./service.ts";

const isBatchReturn = is.TupleOf([is.Array, is.String] as const);

export type Host = Pick<HostOrigin, "redraw" | "call" | "batch">;

export type Service = Pick<ServiceOrigin, "dispatch">;

export class DenopsImpl implements Denops {
  readonly name: string;
  readonly meta: Meta;
  readonly context: Record<PropertyKey, unknown> = {};

  dispatcher: Dispatcher = {};

  #host: Host;
  #service: Service;

  constructor(
    name: string,
    meta: Meta,
    host: Host,
    service: Service,
  ) {
    this.name = name;
    this.meta = meta;
    this.#host = host;
    this.#service = service;
  }

  redraw(force?: boolean): Promise<void> {
    return this.#host.redraw(force);
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.#host.call(fn, ...normArgs(args));
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<unknown[]> {
    const normCalls = calls.map(([fn, ...args]) =>
      [fn, ...normArgs(args)] as const
    );
    const result = await this.#host.batch(...normCalls);
    const [results, errmsg] = ensure(result, isBatchReturn);
    if (errmsg !== "") {
      throw new BatchError(errmsg, results);
    }
    return results;
  }

  async cmd(cmd: string, ctx: Context = {}): Promise<void> {
    await this.#host.call("denops#api#cmd", cmd, ctx);
  }

  eval(expr: string, ctx: Context = {}): Promise<unknown> {
    return this.#host.call("denops#api#eval", expr, ctx);
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
