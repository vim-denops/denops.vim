// NOTE: Use sinon to stub the getter property.
// @deno-types="npm:@types/sinon@^17.0.3"
import sinon from "npm:sinon@^18.0.0";

import {
  assertEquals,
  assertMatch,
  assertNotMatch,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.1";
import {
  assertSpyCallArgs,
  assertSpyCalls,
  resolvesNext,
  returnsNext,
  spy,
  type Stub,
  stub,
} from "jsr:@std/testing@^1.0.0/mock";
import { FakeTime } from "jsr:@std/testing@^1.0.0/time";
import { delay } from "jsr:@std/async@^1.0.1/delay";
import { promiseState } from "jsr:@lambdalisue/async@^2.1.1";
import {
  createFakeTcpConn,
  createFakeTcpListener,
  createFakeWorker,
  pendingPromise,
} from "/denops-testutil/mock.ts";
import { main } from "./cli.ts";

const stubDenoListen = (
  fn: (
    options: Deno.TcpListenOptions & { transpost?: "tcp" },
  ) => Deno.TcpListener,
) => {
  return stub(
    Deno,
    "listen",
    fn as unknown as typeof Deno["listen"],
  ) as unknown as Stub<
    typeof Deno,
    [options: Deno.TcpListenOptions],
    Deno.TcpListener
  >;
};

Deno.test("main()", async (t) => {
  using deno_addSignalListener = stub(Deno, "addSignalListener");

  await t.step("listens", async (t) => {
    await t.step("127.0.0.1:32123", async () => {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));
      using deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      using _console_info = stub(console, "info");

      const p = main([]);

      assertSpyCalls(deno_listen, 1);
      assertSpyCallArgs(deno_listen, 0, [{
        hostname: "127.0.0.1",
        port: 32123,
      }]);

      fakeTcpListener.close();
      await p;
    });

    await t.step("`--hostname`:32123", async () => {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));
      using deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      using _console_info = stub(console, "info");

      const p = main(["--hostname", "foobar.example.net"]);

      assertSpyCalls(deno_listen, 1);
      assertSpyCallArgs(deno_listen, 0, [{
        hostname: "foobar.example.net",
        port: 32123,
      }]);

      fakeTcpListener.close();
      await p;
    });

    await t.step("127.0.0.1:`--port`", async () => {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));
      using deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      using _console_info = stub(console, "info");

      const p = main(["--port", "39393"]);

      assertSpyCalls(deno_listen, 1);
      assertSpyCallArgs(deno_listen, 0, [{
        hostname: "127.0.0.1",
        port: 39393,
      }]);

      fakeTcpListener.close();
      await p;
    });
  });

  await t.step("outputs info logs", async () => {
    const fakeTcpListener = createFakeTcpListener();
    sinon.stub(fakeTcpListener, "addr").get(() => ({
      hostname: "stub.example.net",
      port: 99999,
    }));
    using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
    using console_info = stub(console, "info");

    const p = main([]);

    assertStringIncludes(
      console_info.calls.flatMap((c) => c.args).join(" "),
      "Listen denops clients on stub.example.net:99999",
    );

    fakeTcpListener.close();
    await p;
  });

  await t.step("if `--identity`", async (t) => {
    await t.step("outputs the listen addr FIRST", async () => {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));
      using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      const outputs: unknown[][] = [];
      const appendOutput = (...args: unknown[]) => {
        outputs.push(args);
      };
      using _console_info = stub(console, "info", appendOutput);
      using _console_log = stub(console, "log", appendOutput);

      const p = main(["--identity"]);

      assertEquals(outputs[0], ["stub.example.net:99999"]);

      fakeTcpListener.close();
      await p;
    });

    await t.step("and `--quiet` outputs the listen addr FIRST", async () => {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));
      using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      const outputs: unknown[][] = [];
      const appendOutput = (...args: unknown[]) => {
        outputs.push(args);
      };
      using _console_info = stub(console, "info", appendOutput);
      using _console_log = stub(console, "log", appendOutput);

      const p = main(["--identity", "--quiet"]);

      assertEquals(outputs[0], ["stub.example.net:99999"]);

      fakeTcpListener.close();
      await p;
    });
  });

  await t.step("when the connection is accepted", async (t) => {
    {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));

      const fakeTcpConn = createFakeTcpConn();
      const connStreamCloseWaiter = Promise.withResolvers<void>();
      sinon.stub(fakeTcpConn, "remoteAddr").get(() => ({
        hostname: "stub-remote.example.net",
        port: 98765,
      }));
      sinon.stub(fakeTcpConn, "readable").get(() =>
        new ReadableStream({
          start(con) {
            connStreamCloseWaiter.promise.then(() => con.close());
          },
        })
      );
      sinon.stub(fakeTcpConn, "writable").get(() =>
        new WritableStream({
          start(con) {
            connStreamCloseWaiter.promise.then(() =>
              con.error("fake-tcpconn-writable-closed")
            );
          },
        })
      );

      const fakeWorker = createFakeWorker();
      using globalThis_Worker = stub(
        globalThis,
        "Worker",
        returnsNext([fakeWorker]),
      );
      using worker_terminate = stub(fakeWorker, "terminate");
      using worker_postMessage = stub(fakeWorker, "postMessage");

      using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      using _listener_accept = stub(
        fakeTcpListener,
        "accept",
        resolvesNext([fakeTcpConn, pendingPromise()]),
      );
      using console_info = stub(console, "info");
      using console_error = stub(console, "error");

      const p = main([]);

      await t.step("creates a Worker", async () => {
        assertSpyCalls(globalThis_Worker, 0);

        // Resolves microtasks.
        await delay(0);

        assertSpyCalls(globalThis_Worker, 1);
        assertMatch(
          globalThis_Worker.calls[0].args[0] as string,
          /.*\/denops\/@denops-private\/worker\.ts$/,
          "Worker.specifier should be `*/denops/@denops-private/worker.ts`",
        );
        assertEquals(globalThis_Worker.calls[0].args[1], {
          name: "stub-remote.example.net:98765",
          type: "module",
        }, "Worker.name should be `remote-hostname:remote-port`");
      });

      await t.step("outputs info logs", () => {
        assertStringIncludes(
          console_info.calls.flatMap((c) => c.args).join(" "),
          "stub-remote.example.net:98765 is connected",
        );
      });

      await t.step("when the listener is closed", async (t) => {
        fakeTcpListener.close();
        await delay(0);

        await t.step("does not calls Worker.terminate()", () => {
          assertSpyCalls(worker_terminate, 0);
        });

        await t.step("pendings main() Promise", async () => {
          assertEquals(await promiseState(p), "pending");
        });
      });

      await t.step("when the connection is closed", async (t) => {
        connStreamCloseWaiter.resolve();
        await delay(0);

        await t.step("does not calls Worker.terminate()", () => {
          assertSpyCalls(worker_terminate, 0);
        });

        await t.step("pendings main() Promise", async () => {
          assertEquals(await promiseState(p), "pending");
        });

        await t.step(
          "post a `null` message to tell the worker to close",
          () => {
            assertSpyCalls(worker_postMessage, 1);
            assertSpyCallArgs(worker_postMessage, 0, [null]);
          },
        );

        await t.step("and the worker stream is closed", async (t) => {
          fakeWorker.onmessage(new MessageEvent("message", { data: null }));
          await delay(0);

          await t.step("calls Worker.terminate()", () => {
            assertSpyCalls(worker_terminate, 1);
          });

          await t.step("resolves main() Promise", async () => {
            assertEquals(await promiseState(p), "fulfilled");
          });
        });

        await t.step("outputs error logs", () => {
          assertStringIncludes(
            console_error.calls.flatMap((c) => c.args).join(" "),
            "Internal error occurred and Host/Denops connection is dropped fake-tcpconn-writable-closed",
          );
        });
      });
    }

    {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));

      const fakeTcpConn = createFakeTcpConn();
      const connStreamCloseWaiter = Promise.withResolvers<void>();
      sinon.stub(fakeTcpConn, "remoteAddr").get(() => ({
        hostname: "stub-remote.example.net",
        port: 98765,
      }));
      sinon.stub(fakeTcpConn, "readable").get(() =>
        new ReadableStream({
          start(con) {
            connStreamCloseWaiter.promise.then(() => con.close());
          },
        })
      );
      sinon.stub(fakeTcpConn, "writable").get(() =>
        new WritableStream({
          start(con) {
            connStreamCloseWaiter.promise.then(() =>
              con.error("fake-tcpconn-writable-closed")
            );
          },
        })
      );

      const fakeWorker = createFakeWorker();
      using globalThis_Worker = stub(
        globalThis,
        "Worker",
        returnsNext([fakeWorker]),
      );
      using worker_terminate = stub(fakeWorker, "terminate");
      using _worker_postMessage = stub(fakeWorker, "postMessage");

      using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      using _listener_accept = stub(
        fakeTcpListener,
        "accept",
        resolvesNext([fakeTcpConn, pendingPromise()]),
      );
      using _console_info = stub(console, "info");
      using console_error = stub(console, "error");

      const p = main([]);
      await delay(0);

      await t.step("when the connection is closed", async (t) => {
        assertSpyCalls(globalThis_Worker, 1);

        await t.step("when the worker close times out", async (t) => {
          using _time = new FakeTime();

          connStreamCloseWaiter.resolve();
          const WORKER_CLOSE_TIMEOUT_MS = 5000;
          await _time.tickAsync(WORKER_CLOSE_TIMEOUT_MS);
          await _time.nextAsync();

          await t.step("calls Worker.terminate()", () => {
            assertSpyCalls(worker_terminate, 1);
          });
        });

        await t.step("outputs error logs", () => {
          assertMatch(
            console_error.calls.flatMap((c) => c.args).join(" "),
            /Internal error occurred/,
          );
        });

        await t.step("pendings main() Promise", async () => {
          assertEquals(await promiseState(p), "pending");
        });

        await t.step("and the listner is closed", async (t) => {
          fakeTcpListener.close();

          await t.step("resolves main() Promise", async () => {
            assertEquals(await promiseState(p), "fulfilled");
          });
        });
      });
    }

    {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));

      const fakeTcpConn = createFakeTcpConn();
      const connStreamCloseWaiter = Promise.withResolvers<void>();
      sinon.stub(fakeTcpConn, "remoteAddr").get(() => ({
        hostname: "stub-remote.example.net",
        port: 98765,
      }));
      sinon.stub(fakeTcpConn, "readable").get(() =>
        new ReadableStream({
          start(con) {
            connStreamCloseWaiter.promise.then(() => con.close());
          },
        })
      );
      sinon.stub(fakeTcpConn, "writable").get(() =>
        new WritableStream({
          start(con) {
            connStreamCloseWaiter.promise.then(() =>
              con.error("fake-tcpconn-writable-closed")
            );
          },
        })
      );

      const fakeWorker = createFakeWorker();
      using globalThis_Worker = stub(
        globalThis,
        "Worker",
        returnsNext([fakeWorker]),
      );
      using worker_terminate = stub(fakeWorker, "terminate");
      using _worker_postMessage = stub(fakeWorker, "postMessage");

      using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      using _listener_accept = stub(
        fakeTcpListener,
        "accept",
        resolvesNext([fakeTcpConn, pendingPromise()]),
      );
      using _console_info = stub(console, "info");
      using console_error = stub(console, "error");

      const p = main([]);
      await delay(0);

      await t.step("when the worker stream is closed", async (t) => {
        assertSpyCalls(globalThis_Worker, 1);
        fakeTcpListener.close();

        fakeWorker.onmessage(new MessageEvent("message", { data: null }));
        await delay(0);

        await t.step("calls Worker.terminate()", () => {
          assertSpyCalls(worker_terminate, 1);
        });

        await t.step("resolves main() Promise", async () => {
          assertEquals(await promiseState(p), "fulfilled");
        });

        await t.step("does not outputs error logs", () => {
          assertNotMatch(
            console_error.calls.flatMap((c) => c.args).join(" "),
            /Internal error occurred/,
          );
        });
      });
    }
  });

  await t.step("if `--quiet`", async (t) => {
    await t.step("does not outputs info logs", async () => {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));
      using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      using console_info = stub(console, "info");

      const p = main(["--quiet"]);

      assertSpyCalls(console_info, 0);

      fakeTcpListener.close();
      await p;
    });

    await t.step("when the connection is accepted", async (t) => {
      const fakeTcpListener = createFakeTcpListener();
      sinon.stub(fakeTcpListener, "addr").get(() => ({
        hostname: "stub.example.net",
        port: 99999,
      }));

      const fakeTcpConn = createFakeTcpConn();
      const connStreamCloseWaiter = Promise.withResolvers<void>();
      sinon.stub(fakeTcpConn, "remoteAddr").get(() => ({
        hostname: "stub-remote.example.net",
        port: 98765,
      }));
      sinon.stub(fakeTcpConn, "readable").get(() =>
        new ReadableStream({
          start(con) {
            connStreamCloseWaiter.promise.then(() => con.close());
          },
        })
      );
      sinon.stub(fakeTcpConn, "writable").get(() =>
        new WritableStream({
          start(con) {
            connStreamCloseWaiter.promise.then(() =>
              con.error("fake-tcpconn-writable-closed")
            );
          },
        })
      );

      const fakeWorker = createFakeWorker();
      using _globalThis_Worker = stub(
        globalThis,
        "Worker",
        returnsNext([fakeWorker]),
      );
      using _worker_terminate = stub(fakeWorker, "terminate");
      using _worker_postMessage = stub(fakeWorker, "postMessage");

      using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
      using _listener_accept = stub(
        fakeTcpListener,
        "accept",
        resolvesNext([fakeTcpConn, pendingPromise()]),
      );
      using console_info = stub(console, "info");
      using console_error = stub(console, "error");

      const p = main(["--quiet"]);
      await delay(0);

      await t.step("does not outputs info logs", () => {
        assertNotMatch(
          console_info.calls.flatMap((c) => c.args).join(" "),
          /is connected/,
        );
      });

      fakeTcpListener.close();

      await t.step("when the connection is closed", async (t) => {
        connStreamCloseWaiter.resolve();
        await delay(0);

        await t.step("and the worker stream is closed", async (t) => {
          fakeWorker.onmessage(new MessageEvent("message", { data: null }));
          await delay(0);

          await t.step("outputs error logs", () => {
            assertStringIncludes(
              console_error.calls.flatMap((c) => c.args).join(" "),
              "Internal error occurred and Host/Denops connection is dropped fake-tcpconn-writable-closed",
            );
          });
        });
      });

      await p;
    });
  });

  await t.step("listens SIGINT", async (t) => {
    const prevSignalListenerCalls = deno_addSignalListener.calls.length;
    const fakeTcpListener = createFakeTcpListener();
    sinon.stub(fakeTcpListener, "addr").get(() => ({
      hostname: "stub.example.net",
      port: 99999,
    }));
    using listener_close = spy(fakeTcpListener, "close");
    using _deno_listen = stubDenoListen(returnsNext([fakeTcpListener]));
    using _console_info = stub(console, "info");

    const mainPromise = main([]);
    await delay(0);

    assertSpyCalls(deno_addSignalListener, prevSignalListenerCalls + 1);
    const [
      signal,
      signalHandler,
    ] = deno_addSignalListener.calls[prevSignalListenerCalls].args;
    assertEquals(signal, "SIGINT");

    await t.step("when SINGINT is trapped", async (t) => {
      assertSpyCalls(listener_close, 0);

      signalHandler();
      await delay(0);

      await t.step("closes the listener", () => {
        assertSpyCalls(listener_close, 1);
      });

      await t.step("resolves main() Promise", async () => {
        assertEquals(await promiseState(mainPromise), "fulfilled");
      });
    });
  });
});
