import { ensure, is } from "jsr:@core/unknownutil@3.18.0";
import { Client, Session } from "jsr:@lambdalisue/messagepack-rpc@2.1.1";
import { errorDeserializer, errorSerializer } from "../error.ts";
import { getVersionOr } from "../version.ts";
import { formatCall, type Host, invoke, type Service } from "../host.ts";

export class Neovim implements Host {
  #session: Session;
  #client: Client;
  #service?: Service;

  constructor(
    reader: ReadableStream<Uint8Array>,
    writer: WritableStream<Uint8Array>,
  ) {
    this.#session = new Session(reader, writer, {
      errorSerializer,
    });
    this.#session.dispatcher = {
      void() {
        return Promise.resolve();
      },

      invoke: (method: unknown, args: unknown): Promise<unknown> => {
        if (!this.#service) {
          throw new Error("No service is registered in the host");
        }
        return invoke(
          this.#service,
          ensure(method, is.String),
          ensure(args, is.Array),
        );
      },

      nvim_error_event(type, message) {
        console.error(`nvim_error_event(${type})`, message);
      },
    };
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
  }

  redraw(_force?: boolean): Promise<void> {
    // Do NOTHING on Neovim
    return Promise.resolve();
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    try {
      return await this.#client.call("nvim_call_function", fn, args);
    } catch (err) {
      if (isNvimErrorObject(err)) {
        const [code, message] = err;
        throw new Error(
          `Failed to call ${
            formatCall(fn, ...args)
          }: ${message} (code: ${code})`,
        );
      }
      throw err;
    }
  }

  async batch(
    ...calls: (readonly [string, ...unknown[]])[]
  ): Promise<[unknown[], string]> {
    const result = await this.#client.call(
      "nvim_call_atomic",
      calls.map(([fn, ...args]) => ["nvim_call_function", [fn, args]]),
    );
    const [ret, err] = ensure(result, isNvimCallAtomicReturn);
    if (err) {
      const [index, code, message] = err;
      return [
        ret,
        `Failed to call ${
          formatCall(...calls[index])
        }: ${message} (code: ${code})`,
      ];
    }
    return [ret, ""];
  }

  notify(fn: string, ...args: unknown[]): void {
    this.#client.notify("nvim_call_function", fn, args);
  }

  async init(service: Service): Promise<void> {
    const version = await getVersionOr({});
    await this.#client.call(
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
    this.#service = service;
    this.#service.bind(this);
  }

  waitClosed(): Promise<void> {
    return this.#session.wait();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    try {
      await this.#session.shutdown();
    } catch {
      // Do nothing
    }
  }
}

// nvim_call_function throws a special error object
// https://github.com/neovim/neovim/blob/5dc0bdfe98b59bb03226167ed541d17cc5af30b1/src/nvim/api/vimscript.c#L260
// https://github.com/neovim/neovim/blob/5dc0bdfe98b59bb03226167ed541d17cc5af30b1/src/nvim/api/private/defs.h#L63-L66
const isNvimErrorObject = is.TupleOf([is.Number, is.String] as const);

// nvim_call_atomics returns a tuple of [return values, error details]
const isNvimCallAtomicReturn = is.TupleOf(
  [
    is.Array,
    is.OneOf([
      is.Null,
      // the index, the error type, the error message
      is.TupleOf([is.Number, is.Number, is.String] as const),
    ]),
  ] as const,
);
