import { Dispatcher, Meta } from "../@denops/types.ts";
import { BatchError } from "../@denops/errors.ts";
import { AbstractDenops, normArgs } from "../@denops/abs.ts";
import { Service } from "./service.ts";

export class DenopsImpl extends AbstractDenops {
  readonly name: string;
  readonly meta: Meta;
  #service: Service;
  #dispatcher: Dispatcher;

  constructor(
    name: string,
    meta: Meta,
    service: Service,
  ) {
    super();
    this.name = name;
    this.meta = meta;
    this.#service = service;
    this.#dispatcher = {};
  }

  get dispatcher(): Dispatcher {
    return this.#dispatcher;
  }

  set dispatcher(dispatcher: Dispatcher) {
    this.#dispatcher = dispatcher;
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#service.call(fn, ...normArgs(args));
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<unknown[]> {
    const normCalls: [string, ...unknown[]][] = calls.map((
      [fn, ...args],
    ) => [fn, ...normArgs(args)]);
    const [results, errmsg] = await this.#service.batch(...normCalls);
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
    return await this.#service.dispatch(name, fn, args);
  }
}
