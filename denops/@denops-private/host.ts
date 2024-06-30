import { ensure, is } from "https://deno.land/x/unknownutil@v3.18.1/mod.ts";

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
   * Call host function and do nothing
   */
  notify(fn: string, ...args: unknown[]): void;

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
type CallbackId = string;
export type Service = {
  bind(host: Host): void;
  load(name: string, script: string): Promise<void>;
  reload(name: string): Promise<void>;
  dispatch(name: string, fn: string, args: unknown[]): Promise<unknown>;
  dispatchAsync(
    name: string,
    fn: string,
    args: unknown[],
    success: CallbackId,
    failure: CallbackId,
  ): Promise<void>;
};

export function invoke(
  service: Omit<Service, "bind">,
  name: string,
  args: unknown[],
): Promise<unknown> {
  switch (name) {
    case "load":
      return service.load(
        ...ensure(args, is.TupleOf([is.String, is.String] as const)),
      );
    case "reload":
      return service.reload(
        ...ensure(args, is.TupleOf([is.String] as const)),
      );
    case "dispatch":
      return service.dispatch(
        ...ensure(args, is.TupleOf([is.String, is.String, is.Array] as const)),
      );
    case "dispatchAsync":
      return service.dispatchAsync(
        ...ensure(
          args,
          is.TupleOf(
            [is.String, is.String, is.Array, is.String, is.String] as const,
          ),
        ),
      );
    default:
      throw new Error(`Service does not have a method '${name}'`);
  }
}
