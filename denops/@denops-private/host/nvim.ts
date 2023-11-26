import { assert, is } from "https://deno.land/x/unknownutil@v3.10.0/mod.ts";
import {
  Client,
  Session,
} from "https://deno.land/x/messagepack_rpc@v2.0.3/mod.ts";
import { Invoker, isInvokerMethod } from "./invoker.ts";
import { errorDeserializer, errorSerializer } from "../error.ts";
import { getVersionOr } from "../version.ts";
import type { Host } from "./base.ts";

export class Neovim implements Host {
  #session: Session;
  #client: Client;

  constructor(
    reader: ReadableStream<Uint8Array>,
    writer: WritableStream<Uint8Array>,
  ) {
    this.#session = new Session(reader, writer, {
      errorSerializer,
    });
    this.#session.onMessageError = (error, message) => {
      if (error instanceof Error && error.name === "Interrupted") {
        return;
      }
      console.error(`Failed to handle message ${message}`, error);
    };
    this.#session.start();
    this.#client = new Client(this.#session, {
      errorDeserializer,
    });
    getVersionOr({}).then((version) => {
      this.#client.notify(
        "nvim_set_client_info",
        "denops",
        version,
        "msgpack-rpc",
        {
          invoke: {
            async: false,
            nargs: 2,
          },
        },
        {
          "website": "https://github.com/vim-denops/denops.vim",
          "license": "MIT",
          "logo":
            "https://github.com/vim-denops/denops-logos/blob/main/20210403-main/denops.png?raw=true",
        },
      );
    });
  }

  redraw(_force?: boolean): Promise<void> {
    // Do NOTHING on Neovim
    return Promise.resolve();
  }

  call(fn: string, ...args: unknown[]): Promise<unknown> {
    return this.#client.call("nvim_call_function", fn, args);
  }

  async batch(
    ...calls: [string, ...unknown[]][]
  ): Promise<[unknown[], string]> {
    const [ret, err] = await this.#client.call(
      "nvim_call_atomic",
      calls.map(([fn, ...args]) => ["nvim_call_function", [fn, args]]),
    ) as [unknown[], [number, number, string] | null];
    if (err) {
      return [ret, err[2]];
    }
    return [ret, ""];
  }

  register(invoker: Invoker): void {
    this.#session.dispatcher = {
      nvim_error_event(type, message) {
        console.error(`nvim_error_event(${type})`, message);
      },

      void() {
        return Promise.resolve();
      },

      async invoke(method: unknown, args: unknown): Promise<unknown> {
        assert(method, isInvokerMethod);
        assert(args, is.Array);
        // deno-lint-ignore no-explicit-any
        return await (invoker[method] as any)(...args);
      },
    };
  }

  async waitClosed(): Promise<void> {
    await this.#session.wait();
  }

  async dispose(): Promise<void> {
    try {
      await this.#session.shutdown();
    } catch {
      // Do nothing
    }
  }
}
