// @deno-types="npm:@types/sinon@17.0.3"
import sinon from "npm:sinon@17.0.1";
import { assertEquals, assertInstanceOf } from "jsr:@std/assert@0.225.2";
import { delay } from "jsr:@std/async@0.224.0/delay";
import { DisposableStack } from "jsr:@nick/dispose@1.1.0/disposable-stack";
import * as nvimCodec from "jsr:@lambdalisue/messagepack@^1.0.1";
import { createFakeMeta } from "./testutil/mock.ts";
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
        await t.step({
          name: "sets client info",
          fn: async () => {
            using _ = usePostMessageHistory();
            await delay(0);
            assertEquals(messageStub.postMessage.callCount, 1);
            const request = nvimCodec.decode(
              messageStub.postMessage.getCall(0).args[0],
            ) as unknown[];
            assertEquals(request.slice(0, 3), [0, 1, "nvim_set_client_info"]);
            messageStub.fakeHostMessage(nvimCodec.encode([1, 1, null, 0]));
          },
        });
      }

      await t.step("doautocmd `User DenopsReady`", async () => {
        using _ = usePostMessageHistory();
        await delay(0);
        assertEquals(messageStub.postMessage.callCount, 1);
        if (host === "vim") {
          assertEquals(
            vimCodec.decode(messageStub.postMessage.getCall(0).args[0]),
            [
              "call",
              "denops#api#vim#call",
              ["execute", ["doautocmd <nomodeline> User DenopsReady", ""]],
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
              ["execute", ["doautocmd <nomodeline> User DenopsReady", ""]],
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
              await t.step({
                name: "does nothing",
                fn: async () => {
                  using _ = usePostMessageHistory();
                  const fn = consoleStub[name].set.getCall(0).args[0];

                  fn.apply(globalThis.console, ["foo", 123, false]);

                  await delay(0);
                  assertEquals(messageStub.postMessage.callCount, 0);
                },
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
            }
          });
        }
      });

      await t.step("resolves when stream is closed", async () => {
        // NOTE: Send `null` to close workerio stream.
        messageStub.fakeHostMessage(null);
        await mainPromise;
      });
    });
    await t.step(
      "main() outputs an error log when an internal error occurs",
      async () => {
        using messageStub = stubMessage();
        using consoleStub = stubConsole();
        using _addEventListenerSpy = spyAddEventListener();

        const error = new Error("fake-error");
        messageStub.onmessage.set(() => {
          throw error;
        });

        await main();

        assertEquals(consoleStub.error.callCount, 1);
        assertEquals(consoleStub.error.getCall(0).args, [
          "Internal error occurred in Worker",
          error,
        ]);
      },
    );
  });
}
