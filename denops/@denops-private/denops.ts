import { Context, Denops, Meta } from "../@denops/denops.ts";
import { Dispatcher, Session } from "../@denops/deps.ts";

export class DenopsImpl implements Denops {
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

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#session.call("call", fn, ...args);
  }

  async cmd(cmd: string, ctx: Context = {}): Promise<void> {
    await this.#session.call("call", "denops#api#cmd", cmd, ctx);
  }

  async eval(expr: string, ctx: Context = {}): Promise<unknown> {
    return await this.#session.call("call", "denops#api#eval", expr, ctx);
  }

  async dispatch(
    name: string,
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return await this.#session.call("dispatch", name, fn, ...args);
  }
}
