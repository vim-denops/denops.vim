import { Dispatcher, Session } from "./deps.ts";

/**
 * Context which is expanded to the local namespace (l:)
 */
export type Context = Record<string, unknown>;

/**
 * Environment meta information.
 */
export type Meta = {
  // Current denops mode.
  // In "debug" or "test" mode, some features become enabled
  // which might impact the performance.
  readonly mode: "release" | "debug" | "test";
  // Host program.
  readonly host: "vim" | "nvim";
  // Host program version.
  readonly version: string;
  // Host platform name.
  readonly platform: "windows" | "mac" | "linux";
};

/**
 * Batch error which is raised when one of function fails during batch process
 */
export class BatchError extends Error {
  // A result list which is successfully completed prior to the error
  readonly results: unknown[];

  constructor(message: string, results: unknown[]) {
    super(message);
    this.name = "BatchError";
    this.results = results;
  }
}

/**
 * Asynchronous storage interface
 */
export interface AsyncStorage {
  readonly length: Promise<number>;

  clear(): Promise<void>;

  getItem(key: string): Promise<string | null>;

  key(index: number): Promise<string | null>;

  removeItem(key: string): Promise<void>;

  setItem(key: string, value: string): Promise<void>;
}

/**
 * Denpos is a facade instance visible from each denops plugins.
 */
export interface Denops {
  /**
   * Denops instance name which uses to communicate with vim.
   */
  readonly name: string;

  /**
   * Environment meta information.
   */
  readonly meta: Meta;

  /**
   * Local storage of denops main thread
   */
  readonly localStorage: AsyncStorage;

  /**
   * Session storage of denops main thread
   */
  readonly sessionStorage: AsyncStorage;

  /**
   * User defined API name and method map which is used to dispatch API request
   */
  dispatcher: Dispatcher;

  /**
   * Call an arbitrary function of Vim/Neovim and return the result
   *
   * @param fn: A function name of Vim/Neovim.
   * @param args: Arguments of the function.
   *
   * Note that aruguments after `undefined` in `args` will be dropped for convenience.
   */
  call(fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Call arbitrary functions of Vim/Neovim sequentially without redraw and
   * return the results.
   *
   * It throw a BatchError when one of a function fails. The `results` attribute
   * of the error instance holds successed results of functions prior to the
   * error.
   *
   * @param calls: A list of tuple ([fn, args]) to call Vim/Neovim functions.
   *
   * Note that aruguments after `undefined` in `args` will be dropped for convenience.
   */
  batch(...calls: [string, ...unknown[]][]): Promise<unknown[]>;

  /**
   * Execute an arbitrary command of Vim/Neovim under a given context.
   *
   * @param cmd: A command expression to be executed.
   * @param ctx: A context object which is expanded to the local namespace (l:)
   */
  cmd(cmd: string, ctx?: Context): Promise<void>;

  /**
   * Evaluate an arbitrary expression of Vim/Neovim under a given context and return the result.
   *
   * @param expr: An expression to be evaluated.
   * @param ctx: A context object which is expanded to the local namespace (l:)
   */
  eval(expr: string, ctx?: Context): Promise<unknown>;

  /**
   * Dispatch an arbitrary function of an arbitrary plugin and return the result.
   *
   * @param name: A plugin registration name.
   * @param fn: A function name in the API registration.
   * @param args: Arguments of the function.
   */
  dispatch(name: string, fn: string, ...args: unknown[]): Promise<unknown>;
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

export class DenopsImpl implements Denops {
  readonly name: string;
  readonly meta: Meta;
  readonly localStorage: AsyncStorage;
  readonly sessionStorage: AsyncStorage;

  #session: Session;

  constructor(
    name: string,
    meta: Meta,
    session: Session,
  ) {
    this.name = name;
    this.meta = meta;
    this.localStorage = new AsyncStorageImpl("local", session);
    this.sessionStorage = new AsyncStorageImpl("session", session);
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

class AsyncStorageImpl implements AsyncStorage {
  #name: "local" | "session";
  #session: Session;

  constructor(name: "local" | "session", session: Session) {
    this.#name = name;
    this.#session = session;
  }

  get length() {
    return this.#session.call(`${this.#name}Storage:length`) as Promise<number>;
  }

  async clear() {
    await this.#session.call(`${this.#name}Storage:clear`);
  }

  async getItem(key: string) {
    return await this.#session.call(
      `${this.#name}Storage:getItem`,
      key,
    ) as Promise<string>;
  }

  async key(index: number) {
    return await this.#session.call(
      `${this.#name}Storage:key`,
      index,
    ) as Promise<string>;
  }

  async removeItem(key: string) {
    await this.#session.call(`${this.#name}Storage:removeItem`, key);
  }

  async setItem(key: string, value: string) {
    await this.#session.call(`${this.#name}Storage:setItem`, key, value);
  }
}
