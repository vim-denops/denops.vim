// @deno-types="npm:@types/sinon@17.0.3"
import sinon from "npm:sinon@17.0.1";
import {
  assertEquals,
  assertInstanceOf,
  assertMatch,
  assertObjectMatch,
} from "jsr:@std/assert@0.225.2";
import {
  assertSpyCalls,
  resolvesNext,
  spy,
  stub,
} from "jsr:@std/testing@0.224.0/mock";
import { delay } from "jsr:@std/async@0.224.0/delay";
import { DisposableStack } from "jsr:@nick/dispose@1.1.0/disposable-stack";
import * as nvimCodec from "jsr:@lambdalisue/messagepack@^1.0.1";
import { createFakeMeta } from "/denops-testutil/mock.ts";
import { Neovim } from "./host/nvim.ts";
import { Vim } from "./host/vim.ts";
import { Service } from "./service.ts";
import { main } from "./worker.ts";

const CONSOLE_PATCH_METHODS = [
  "log",
  "info",
  "debug",
  "warn",
  "error",
] as const satisfies (keyof typeof console)[];

function stubConsole() {
  const target = globalThis.console;
  const sandbox = sinon.createSandbox();
  const entries = CONSOLE_PATCH_METHODS.map((name) => {
    type Fn = typeof target[typeof name];
    const fn = sandbox.fake((() => {}) as Fn);
    const bindedFn = fn.bind(target);
    const get = sandbox.fake(() => bindedFn);
    const set = sandbox.fake<[fn: Fn], void>();
    sandbox.stub(target, name).get(get).set(set);
    return [name, Object.assign(fn, { get, set })] as const;
  });
  const methods = Object.fromEntries(entries) as Record<
    typeof entries[number][0],
    typeof entries[number][1]
  >;
  return Object.assign(methods, {
    [Symbol.dispose]() {
      sandbox.restore();
    },
  });
}

function stubMessage() {
  const workerGlobal = globalThis as DedicatedWorkerGlobalScope;
  const sandbox = sinon.createSandbox();
  sandbox.define(workerGlobal, "postMessage", () => {});
  const postMessage = sandbox.stub(workerGlobal, "postMessage");
  sandbox.define(workerGlobal, "onmessage", null);
  const onmessage = sandbox.stub(workerGlobal, "onmessage");
  const fakeHostMessage = (data: unknown) => {
    workerGlobal.onmessage?.(new MessageEvent("message", { data }));
  };
  return {
    postMessage,
    onmessage,
    /** Send fake message to worker global. */
    fakeHostMessage,
    [Symbol.dispose]() {
      sandbox.restore();
    },
  };
}

function spyAddEventListener() {
  const stack = new DisposableStack();
  const stub = stack.adopt(
    sinon.stub(globalThis, "addEventListener")
      .callsFake((...args) => {
        stub.wrappedMethod.call(globalThis, ...args);
        stack.defer(() => {
          globalThis.removeEventListener(...args);
        });
      }),
    (stub) => stub.restore(),
  );
  return Object.assign(stub, {
    [Symbol.dispose]() {
      stack.dispose();
    },
  });
}

function stubDenoCommand() {
  const sandbox = sinon.createSandbox();
  sandbox.stub(Deno.Command.prototype, "output").resolves({
    success: true,
    stdout: _encoder.encode("v11.22.33-abcdef01"),
    stderr: new Uint8Array(),
    code: 0,
    signal: null,
  });
  return {
    [Symbol.dispose]() {
      sandbox.restore();
    },
  };
}

const _encoder = new TextEncoder();
const _decoder = new TextDecoder();
const vimCodec = {
  encode: (value: unknown) => _encoder.encode(`${JSON.stringify(value)}\n`),
  decode: (bytes: Uint8Array) => JSON.parse(_decoder.decode(bytes)),
};

const HOSTS = ["vim", "nvim"] as const;
const MODES = ["test", "debug"] as const;
const matrix = HOSTS.flatMap((host) => MODES.map((mode) => ({ host, mode })));

for (const { host, mode } of matrix) {
  Deno.test(`(host: ${host}, mode: ${mode})`, async (t) => {
    await t.step("main()", async (t) => {
      using messageStub = stubMessage();
      using consoleStub = stubConsole();
      using _addEventListenerSpy = spyAddEventListener();
      using _denoCommandStub = stubDenoCommand();
      using deno_addSignalListener = stub(Deno, "addSignalListener");
      using host_asyncDispose = spy(
        (host === "vim" ? Vim : Neovim).prototype,
        Symbol.asyncDispose,
      );
      using service_asyncDispose = spy(
        Service.prototype,
        Symbol.asyncDispose,
      );
      using self_close = stub(globalThis, "close");
      const usePostMessageHistory = () => ({
        [Symbol.dispose]: () => messageStub.postMessage.resetHistory(),
      });
      const fakeMeta = { ...createFakeMeta(), host, mode };

      const mainPromise = main();

      await t.step("catches unhandledrejection", async () => {
        const error = new Error("error");

        new Promise(() => {
          throw error;
        });

        await delay(0);
        assertEquals(consoleStub.error.firstCall.args, [
          "Unhandled rejection:",
          error,
        ]);
      });

      // Initial message from the host.
      if (host === "vim") {
        messageStub.fakeHostMessage(vimCodec.encode([0, ["void"]]));
      } else {
        messageStub.fakeHostMessage(nvimCodec.encode([2, "void", []]));
      }

      await t.step("requests Meta data", async () => {
        using _ = usePostMessageHistory();
        await delay(0);
        assertEquals(messageStub.postMessage.callCount, 1);
        if (host === "vim") {
          assertEquals(
            vimCodec.decode(messageStub.postMessage.getCall(0).args[0]),
            [
              "call",
              "denops#api#vim#call",
              ["denops#_internal#meta#get", []],
              -1,
            ],
          );
          messageStub.fakeHostMessage(vimCodec.encode([-1, [fakeMeta, ""]]));
        } else {
          assertEquals(
            nvimCodec.decode(messageStub.postMessage.getCall(0).args[0]),
            [
              0,
              0,
              "nvim_call_function",
              ["denops#_internal#meta#get", []],
            ],
          );
          messageStub.fakeHostMessage(nvimCodec.encode([1, 0, null, fakeMeta]));
        }
      });

      if (host === "nvim") {
        await t.step("sets client info", async () => {
          using _ = usePostMessageHistory();
          await delay(0);
          assertEquals(messageStub.postMessage.callCount, 1);
          const request = nvimCodec.decode(
            messageStub.postMessage.getCall(0).args[0],
          ) as unknown[];
          assertEquals(request.slice(0, 3), [0, 1, "nvim_set_client_info"]);
          messageStub.fakeHostMessage(nvimCodec.encode([1, 1, null, 0]));
        });
      }

      await t.step("doautocmd `User DenopsSystemReady`", async () => {
        using _ = usePostMessageHistory();
        await delay(0);
        assertEquals(messageStub.postMessage.callCount, 1);
        if (host === "vim") {
          assertEquals(
            vimCodec.decode(messageStub.postMessage.getCall(0).args[0]),
            [
              "call",
              "denops#api#vim#call",
              ["execute", [
                "doautocmd <nomodeline> User DenopsSystemReady",
                "",
              ]],
              -2,
            ],
          );
          messageStub.fakeHostMessage(vimCodec.encode([-2, ["", ""]]));
        } else {
          assertEquals(
            nvimCodec.decode(messageStub.postMessage.getCall(0).args[0]),
            [
              0,
              2,
              "nvim_call_function",
              ["execute", [
                "doautocmd <nomodeline> User DenopsSystemReady",
                "",
              ]],
            ],
          );
          messageStub.fakeHostMessage(nvimCodec.encode([1, 2, null, ""]));
        }
      });

      await t.step("patches `console`", async (t) => {
        for (const name of CONSOLE_PATCH_METHODS) {
          await t.step(`.${name}()`, async (t) => {
            await t.step("is patched", () => {
              assertEquals(consoleStub[name].set.callCount, 1);
              assertInstanceOf(
                consoleStub[name].set.getCall(0).args[0],
                Function,
              );
            });

            if (name === "debug" && fakeMeta.mode !== "debug") {
              await t.step("does nothing", async () => {
                using _ = usePostMessageHistory();
                const fn = consoleStub[name].set.getCall(0).args[0];

                fn.apply(globalThis.console, ["foo", 123, false]);

                await delay(0);
                assertEquals(messageStub.postMessage.callCount, 0);
              });
            } else {
              await t.step({
                name: `notifies \`denops#_internal#echo#${name}\``,
                fn: async () => {
                  using _ = usePostMessageHistory();
                  const fn = consoleStub[name].set.getCall(0).args[0];
                  const errorWithStack = Object.assign(
                    new Error("fake-error-with-stack"),
                    {
                      stack:
                        "Error: fake-error-with-stack\n  at foo (bar.ts:10:20)",
                    },
                  );
                  const errorWithoutStack = Object.assign(
                    new Error("fake-error-without-stack"),
                    { stack: undefined },
                  );

                  fn.apply(globalThis.console, [
                    "foo",
                    123,
                    false,
                    errorWithStack,
                    errorWithoutStack,
                  ]);

                  await delay(0);
                  assertEquals(messageStub.postMessage.callCount, 1);
                  if (host === "vim") {
                    assertEquals(
                      vimCodec.decode(
                        messageStub.postMessage.getCall(0).args[0],
                      ),
                      [
                        "call",
                        `denops#_internal#echo#${name}`,
                        [
                          "foo",
                          "123",
                          "false",
                          "Error: fake-error-with-stack\n  at foo (bar.ts:10:20)",
                          "Error: fake-error-without-stack",
                        ],
                      ],
                    );
                  } else {
                    assertEquals(
                      nvimCodec.decode(
                        messageStub.postMessage.getCall(0).args[0],
                      ),
                      [
                        2,
                        "nvim_call_function",
                        [
                          `denops#_internal#echo#${name}`,
                          [
                            "foo",
                            "123",
                            "false",
                            "Error: fake-error-with-stack\n  at foo (bar.ts:10:20)",
                            "Error: fake-error-without-stack",
                          ],
                        ],
                      ],
                    );
                  }
                },
              });

              await t.step(`calls native \`console.${name}\``, async () => {
                const notifyError = new Error("fake-post-error");
                using _host_notify = stub(
                  (host === "vim" ? Vim : Neovim).prototype,
                  "notify",
                  resolvesNext<void>([notifyError]),
                );
                const nativeMethod = consoleStub[name];
                nativeMethod.resetHistory();
                const fn = consoleStub[name].set.getCall(0).args[0];
                const error = new Error("fake-error");

                fn.apply(globalThis.console, ["foo", 123, false, error]);

                await delay(0);
                assertEquals(nativeMethod.callCount, 1);
                assertObjectMatch(nativeMethod.getCall(0), {
                  thisValue: globalThis.console,
                  args: [
                    "foo",
                    123,
                    false,
                    error,
                  ],
                });
              });
            }
          });
        }
      });

      await t.step("listens SIGINT", () => {
        assertSpyCalls(deno_addSignalListener, 1);
        const [signal, signalHandler] = deno_addSignalListener.calls[0].args;
        assertEquals(signal, "SIGINT");
        assertInstanceOf(signalHandler, Function);
      });

      await t.step("before stream is closed", async (t) => {
        await t.step("does not dispose service", () => {
          assertSpyCalls(service_asyncDispose, 0);
        });

        await t.step("does not dispose host", () => {
          assertSpyCalls(host_asyncDispose, 0);
        });

        await t.step("does not close worker", () => {
          assertSpyCalls(self_close, 0);
        });
      });

      // NOTE: Send `null` to close workerio stream.
      messageStub.fakeHostMessage(null);
      await delay(0);

      await t.step("after stream is closed", async (t) => {
        await t.step("disposes service", () => {
          assertSpyCalls(service_asyncDispose, 1);
        });

        await t.step("disposes host", () => {
          assertSpyCalls(host_asyncDispose, 1);
        });

        await t.step("closes worker", async () => {
          assertSpyCalls(self_close, 1);
          await mainPromise;
        });
      });
    });

    await t.step("main() if it raises an internal error", async (t) => {
      using messageStub = stubMessage();
      using consoleStub = stubConsole();
      using _addEventListenerSpy = spyAddEventListener();
      using self_close = stub(globalThis, "close");

      const error = new Error("fake-error");
      messageStub.onmessage.set(() => {
        throw error;
      });

      await main();

      await t.step("outputs an error log", () => {
        assertEquals(consoleStub.error.callCount, 1);
        assertEquals(consoleStub.error.getCall(0).args, [
          "Internal error occurred in Worker",
          error,
        ]);
      });

      await t.step("closes worker", () => {
        assertSpyCalls(self_close, 1);
      });
    });

    await t.step("main() if SIGINT is trapped", async (t) => {
      using messageStub = stubMessage();
      using consoleStub = stubConsole();
      using _addEventListenerSpy = spyAddEventListener();
      using _denoCommandStub = stubDenoCommand();
      using deno_addSignalListener = stub(Deno, "addSignalListener");
      using host_asyncDispose = spy(
        (host === "vim" ? Vim : Neovim).prototype,
        Symbol.asyncDispose,
      );
      using service_asyncDispose = spy(
        Service.prototype,
        Symbol.asyncDispose,
      );
      using self_close = stub(globalThis, "close");
      const fakeMeta = { ...createFakeMeta(), host, mode };

      const mainPromise = main();

      if (host === "vim") {
        // Initial message from the host.
        messageStub.fakeHostMessage(vimCodec.encode([0, ["void"]]));
        await delay(0);
        // requests Meta data
        messageStub.fakeHostMessage(vimCodec.encode([-1, [fakeMeta, ""]]));
        await delay(0);
        // doautocmd `User DenopsSystemReady`
        messageStub.fakeHostMessage(vimCodec.encode([-2, ["", ""]]));
        await delay(0);
      } else {
        // Initial message from the host.
        messageStub.fakeHostMessage(nvimCodec.encode([2, "void", []]));
        await delay(0);
        // requests Meta data
        messageStub.fakeHostMessage(nvimCodec.encode([1, 0, null, fakeMeta]));
        await delay(0);
        // sets client info
        messageStub.fakeHostMessage(nvimCodec.encode([1, 1, null, 0]));
        await delay(0);
        // doautocmd `User DenopsSystemReady`
        messageStub.fakeHostMessage(nvimCodec.encode([1, 2, null, ""]));
        await delay(0);
      }

      const [_signal, signalHandler] = deno_addSignalListener.calls[0].args;
      consoleStub.error.resetHistory();

      signalHandler();
      await delay(0);

      await t.step("outputs an error log", () => {
        assertEquals(consoleStub.error.callCount, 1);
        assertMatch(
          `${consoleStub.error.getCall(0).args[1]}`,
          /^SignalError: SIGINT is trapped/,
        );
      });

      await t.step("disposes service", () => {
        assertSpyCalls(service_asyncDispose, 1);
      });

      await t.step("disposes host", () => {
        assertSpyCalls(host_asyncDispose, 1);
      });

      await t.step("closes worker", async () => {
        assertSpyCalls(self_close, 1);
        await mainPromise;
      });
    });

    await t.step("main() if service is closed", async (t) => {
      using messageStub = stubMessage();
      using _consoleStub = stubConsole();
      using _addEventListenerSpy = spyAddEventListener();
      using _denoCommandStub = stubDenoCommand();
      using _deno_addSignalListener = stub(Deno, "addSignalListener");
      using host_asyncDispose = spy(
        (host === "vim" ? Vim : Neovim).prototype,
        Symbol.asyncDispose,
      );
      using service_asyncDispose = spy(
        Service.prototype,
        Symbol.asyncDispose,
      );
      const service_waitClosed_waiter = Promise.withResolvers<void>();
      using service_waitClosed = stub(
        Service.prototype,
        "waitClosed",
        () => service_waitClosed_waiter.promise,
      );
      using self_close = stub(globalThis, "close");
      const fakeMeta = { ...createFakeMeta(), host, mode };

      const mainPromise = main();

      if (host === "vim") {
        // Initial message from the host.
        messageStub.fakeHostMessage(vimCodec.encode([0, ["void"]]));
        await delay(0);
        // requests Meta data
        messageStub.fakeHostMessage(vimCodec.encode([-1, [fakeMeta, ""]]));
        await delay(0);
        // doautocmd `User DenopsSystemReady`
        messageStub.fakeHostMessage(vimCodec.encode([-2, ["", ""]]));
        await delay(0);
      } else {
        // Initial message from the host.
        messageStub.fakeHostMessage(nvimCodec.encode([2, "void", []]));
        await delay(0);
        // requests Meta data
        messageStub.fakeHostMessage(nvimCodec.encode([1, 0, null, fakeMeta]));
        await delay(0);
        // sets client info
        messageStub.fakeHostMessage(nvimCodec.encode([1, 1, null, 0]));
        await delay(0);
        // doautocmd `User DenopsSystemReady`
        messageStub.fakeHostMessage(nvimCodec.encode([1, 2, null, ""]));
        await delay(0);
      }

      assertSpyCalls(service_waitClosed, 1);
      service_waitClosed_waiter.resolve();
      await delay(0);

      await t.step("disposes service", () => {
        assertSpyCalls(service_asyncDispose, 1);
      });

      await t.step("disposes host", () => {
        assertSpyCalls(host_asyncDispose, 1);
      });

      await t.step("closes worker", async () => {
        assertSpyCalls(self_close, 1);
        await mainPromise;
      });
    });
  });
}
