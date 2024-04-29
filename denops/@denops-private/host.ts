import { ensure, is, type Predicate } from "jsr:@core/unknownutil@3.18.1";
import type { ScriptLoadOptions, Service as ServiceOrigin } from "./service.ts";

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
export type Service = Pick<
  ServiceOrigin,
  | "bind"
  | "load"
  | "unload"
  | "reload"
  | "dispatch"
  | "dispatchAsync"
  | "close"
>;

type ServiceForInvoke = Omit<Service, "bind">;

export function invoke(
  service: ServiceForInvoke,
  name: string,
  args: unknown[],
): Promise<unknown> {
  switch (name) {
    case "load":
      return service.load(...ensure(args, isServiceArgs.load));
    case "unload":
      return service.unload(...ensure(args, isServiceArgs.unload));
    case "reload":
      return service.reload(...ensure(args, isServiceArgs.reload));
    case "dispatch":
      return service.dispatch(...ensure(args, isServiceArgs.dispatch));
    case "dispatchAsync":
      return service.dispatchAsync(
        ...ensure(args, isServiceArgs.dispatchAsync),
      );
    case "close":
      return service.close(...ensure(args, isServiceArgs.close));
    default:
      throw new Error(`Service does not have a method '${name}'`);
  }
}

export function formatCall(fn: string, ...args: unknown[]): string {
  return `${fn}(${args.map((v) => JSON.stringify(v)).join(", ")})`;
}

const isScriptLoadOptions = is.ObjectOf({
  forceReload: is.OptionalOf(is.Boolean),
}) satisfies Predicate<ScriptLoadOptions>;

const isServiceArgs = {
  load: is.ParametersOf(
    [is.String, is.String, is.OptionalOf(isScriptLoadOptions)] as const,
  ),
  unload: is.ParametersOf([is.String] as const),
  reload: is.ParametersOf(
    [is.String, is.OptionalOf(isScriptLoadOptions)] as const,
  ),
  dispatch: is.ParametersOf([is.String, is.String, is.Array] as const),
  dispatchAsync: is.ParametersOf(
    [is.String, is.String, is.Array, is.String, is.String] as const,
  ),
  close: is.ParametersOf([] as const),
} as const satisfies {
  [K in keyof ServiceForInvoke]: Predicate<Parameters<ServiceForInvoke[K]>>;
};
