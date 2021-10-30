import { Session } from "https://deno.land/x/msgpack_rpc@v3.1.4/mod.ts#^";
import { Dispatcher, Meta } from "../../@denops/types.ts";
import { BatchError } from "../../@denops/errors.ts";
import { AbstractDenops, normArgs } from "../../@denops/abs.ts";

export class DenopsImpl extends AbstractDenops {
  readonly name: string;
  readonly meta: Meta;
  #session: Session;

  constructor(
    name: string,
    meta: Meta,
    session: Session,
  ) {
    super();
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
    return await this.#session.call("call", fn, ...normArgs(args));
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

  async dispatch(
    name: string,
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return await this.#session.call("dispatch", name, fn, ...args);
  }
}
