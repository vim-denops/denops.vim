import { Session } from "./deps.ts";
import { Host } from "./host/mod.ts";

export class Service {
  #plugins: { [key: string]: Session };
  #host: Host;

  constructor(host: Host) {
    this.#plugins = {};
    this.#host = host;
  }

  static register(service: Service, name: string, session: Session): void {
    service.#plugins[name] = session;
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const session = this.#plugins[name];
      if (!session) {
        throw new Error(`No plugin '${name}' is registered`);
      }
      return await session.call(fn, ...args);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e.toString()}`;
    }
  }

  dispatchAsync(
    name: string,
    fn: string,
    args: unknown[],
    success: string, // Callback ID
    failure: string, // Callback ID
  ): Promise<void> {
    this.dispatch(name, fn, args)
      .then((r) => this.#host.call("denops#callback#call", success, r))
      .catch((e) => this.#host.call("denops#callback#call", failure, e))
      .catch((e) => {
        console.error(`${e.stack ?? e.toString()}`);
      });
    return Promise.resolve();
  }
}
