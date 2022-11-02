import { deferred } from "https://deno.land/x/msgpack_rpc@v3.1.6/deps.ts";
import { Host } from "./base.ts";

export class HostContainer {
  readonly #container: Set<Host> = new Set();
  #cleared = deferred<void>();

  get size() {
    return this.#container.size;
  }

  add(host: Host): void {
    this.#container.add(host);
  }

  delete(host: Host): void {
    this.#container.delete(host);
    if (this.#container.size === 0) {
      this.#cleared.resolve();
    }
  }

  async terminate(reason: number): Promise<void> {
    if (this.#container.size > 0) {
      this.#cleared = deferred<void>();
      await Promise.allSettled(
        Array.from(this.#container).map((host) =>
          host.call("denops#server#_on_exit", reason).finally(() =>
            host.dispose()
          )
        ),
      );
      await this.#cleared;
    }
  }
}
