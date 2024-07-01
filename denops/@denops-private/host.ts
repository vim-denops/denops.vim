import { ensure, is, type Predicate } from "jsr:@core/unknownutil@3.18.0";

/**
 * Host (Vim/Neovim) which is visible from Service
 */
export interface Host extends AsyncDisposable {
  /**
   * Redraw text and cursor on Vim but Neovim.
   */
  redraw(force?: boolean): Promise<void>;

  /**
   * Call host function and return result
   */
  call(fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Batch call host functions and return results and error
   */
  batch(
    ...calls: (readonly [string, ...unknown[]])[]
  ): Promise<[unknown[], string]>;

  /**
   * Call host function and does not check results
   */
  notify(fn: string, ...args: unknown[]): Promise<void>;

  /**
   * Initialize host
   */
  init(service: Service): Promise<void>;

  /**
   * Wait host close
   */
  waitClosed(): Promise<void>;
}

export type HostConstructor = {
  new (
    readable: ReadableStream<Uint8Array>,
    writable: WritableStream<Uint8Array>,
  ): Host;
};

// Minimum interface of Service that Host is relies on
export type CallbackId = string;
export type Service = {
  bind(host: Host): void;
  load(name: string, script: string): Promise<void>;
  reload(name: string): Promise<void>;
  interrupt(reason?: unknown): void;
  dispatch(name: string, fn: string, args: unknown[]): Promise<unknown>;
  dispatchAsync(
    name: string,
    fn: string,
    args: unknown[],
    success: CallbackId,
    failure: CallbackId,
  ): Promise<void>;
  close(): Promise<void>;
};

type ServiceForInvoke = Omit<Service, "bind">;

export function invoke(
  service: ServiceForInvoke,
  name: string,
  args: unknown[],
): Promise<unknown> {
  switch (name) {
    case "load":
      return service.load(...ensure(args, serviceMethodArgs.load));
    case "reload":
      return service.reload(...ensure(args, serviceMethodArgs.reload));
    case "interrupt":
      service.interrupt(...ensure(args, serviceMethodArgs.interrupt));
      return Promise.resolve();
    case "dispatch":
      return service.dispatch(...ensure(args, serviceMethodArgs.dispatch));
    case "dispatchAsync":
      return service.dispatchAsync(
        ...ensure(args, serviceMethodArgs.dispatchAsync),
      );
    case "close":
      return service.close(...ensure(args, serviceMethodArgs.close));
    default:
      throw new Error(`Service does not have a method '${name}'`);
  }
}

const serviceMethodArgs = {
  load: is.ParametersOf([is.String, is.String] as const),
  reload: is.ParametersOf([is.String] as const),
  interrupt: is.ParametersOf([is.OptionalOf(is.Unknown)] as const),
  dispatch: is.ParametersOf([is.String, is.String, is.Array] as const),
  dispatchAsync: is.ParametersOf(
    [is.String, is.String, is.Array, is.String, is.String] as const,
  ),
  close: is.ParametersOf([] as const),
} as const satisfies {
  [K in keyof ServiceForInvoke]: Predicate<Parameters<ServiceForInvoke[K]>>;
};
