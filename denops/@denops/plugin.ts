import { DispatcherFrom, Session } from "./deps.ts";
import { Service } from "./service.ts";
import { ensureArray, ensureString } from "./utils.ts";

/**
 * Plugin API which is visible from each denops plugins through msgpack-rpc
 */
interface PluginApi {
  /**
   * Dispatch an arbitrary function of an arbitrary plugin and return the result.
   *
   * @param name: A plugin name
   * @param fn: A function name
   * @param args: Arguments
   */
  dispatch(name: string, fn: string, ...args: unknown[]): Promise<unknown>;

  /**
   * Call an arbitrary function of the host and return the result.
   *
   * @param fn: A function name
   * @param args: Arguments
   */
  call(fn: string, ...args: unknown[]): Promise<unknown>;
}

/**
 * An instance of denops plugin
 */
export class Plugin {
  #session: Session;
  #service: Service;

  constructor(
    reader: Deno.Reader & Deno.Closer,
    writer: Deno.Writer,
    service: Service,
  ) {
    const dispatcher: DispatcherFrom<PluginApi> = {
      dispatch: async (name, fn, ...args) => {
        ensureString(name, "name");
        ensureString(fn, "fn");
        ensureArray(args, "args");
        return await this.#service.dispatch(name, fn, args);
      },

      call: async (fn, ...args) => {
        ensureString(fn, "fn");
        ensureArray(args, "args");
        return await this.#service.host.call(fn, ...args);
      },
    };
    this.#service = service;
    this.#session = new Session(reader, writer, dispatcher, {
      errorCallback(e) {
        console.error("Plugin server is closed with error:", e);
      },
    });
  }

  /**
   * Call an arbitrary function of the host and return the result.
   */
  async call(
    fn: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return await this.#session.call(fn, ...args);
  }
}
