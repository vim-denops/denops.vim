import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from "@std/assert";
import { flushPromises, peekPromiseState } from "@core/asyncutil";
import {
  createFakeTcpConn,
  createFakeTcpListener,
  createFakeWorker,
  pendingPromise,
} from "./mock.ts";
import { assertThrows } from "@std/assert/throws";
import { assertSpyCalls, resolvesNext, spy, stub } from "@std/testing/mock";

// deno-lint-ignore no-explicit-any
type AnyFn = (...args: any[]) => unknown;

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<PropertyKey, any>;

type MethodKeyOf<T extends AnyRecord> = ({
  [K in keyof T]: T[K] extends AnyFn ? K : never;
})[keyof T];

type GetterKeyOf<T extends AnyRecord> = ({
  [K in keyof T]: T[K] extends AnyFn ? never : K;
})[keyof T];

Deno.test("pendingPromise()", async (t) => {
  await t.step("returns a pending Promise", async () => {
    const actual = pendingPromise();

    assertInstanceOf(actual, Promise);
    assertEquals(await peekPromiseState(actual), "pending");
  });
});

Deno.test("createFakeTcpListener()", async (t) => {
  await t.step("returns a TcpListener like object", async (t) => {
    const listener = createFakeTcpListener();

    await t.step("has own key", async (t) => {
      const keys = Reflect.ownKeys(
        {
          addr: 0,
          rid: 0,
          ref: 0,
          unref: 0,
          accept: 0,
          close: 0,
          [Symbol.asyncIterator]: 0,
          [Symbol.dispose]: 0,
        } as const satisfies Record<
          // NOTE: 'rid' is removed from Deno v2
          keyof { rid: unknown } & Deno.TcpListener,
          0
        >,
      );
      for (const key of keys) {
        await t.step(key.toString(), () => {
          assert(key in listener);
        });
      }
    });

    await t.step("unimplements", async (t) => {
      const unimplementedProps = [
        "addr",
        "rid",
      ] as const satisfies readonly GetterKeyOf<
        // NOTE: 'rid' is removed from Deno v2
        { rid: unknown } & Deno.TcpListener
      >[];
      for (const key of unimplementedProps) {
        await t.step(`.${key}`, () => {
          assertThrows(() => listener[key], Error, "Unimplemented");
        });
      }

      const unimplementedMethods = [
        "ref",
        "unref",
      ] as const satisfies readonly MethodKeyOf<Deno.TcpListener>[];
      for (const key of unimplementedMethods) {
        await t.step(`.${key}()`, () => {
          assertThrows(() => listener[key](), Error, "Unimplemented");
        });
      }
    });

    await t.step(".accept()", async (t) => {
      await t.step("returns a pending Promise", async () => {
        const promise = listener.accept();

        assertInstanceOf(promise, Promise);
        assertEquals(await peekPromiseState(promise), "pending");
      });
    });

    await t.step(".close()", async (t) => {
      const iterator = listener[Symbol.asyncIterator]();
      const resultPromise = iterator.next();

      await t.step("closes the conn iterator", async () => {
        assertEquals(await peekPromiseState(resultPromise), "pending");

        listener.close();
        await flushPromises();

        assertEquals(await peekPromiseState(resultPromise), "fulfilled");
        assertEquals(await resultPromise, {
          done: true,
          value: undefined,
        });
      });

      await t.step("throws if already closed", () => {
        assertThrows(() => listener.close(), Error, "closed");
      });
    });

    await t.step("[Symbol.asyncIterator]()", async (t) => {
      // deno-lint-ignore no-explicit-any
      const firstAcceptWaiter = Promise.withResolvers<any>();
      const listener = createFakeTcpListener();
      using listener_accept = stub(
        listener,
        "accept",
        resolvesNext([
          firstAcceptWaiter.promise,
          pendingPromise(),
        ]),
      );

      let iterator: AsyncIterator<Deno.TcpConn>;
      await t.step("returns the conn iterator", () => {
        iterator = listener[Symbol.asyncIterator]();

        assertInstanceOf(iterator.next, Function);
      });

      await t.step("yield a TcpConn when .accept() resolves", async () => {
        const resultPromise = iterator.next();

        assertSpyCalls(listener_accept, 1);
        assertEquals(await peekPromiseState(resultPromise), "pending");

        firstAcceptWaiter.resolve("fake-tcp-conn");
        await flushPromises();

        assertEquals(await peekPromiseState(resultPromise), "fulfilled");
        assertEquals(await resultPromise, {
          done: false,
          // deno-lint-ignore no-explicit-any
          value: "fake-tcp-conn" as any,
        });
      });

      await t.step("rejects when .accept() rejcets", async () => {
        const listener = createFakeTcpListener();
        using listener_accept = stub(
          listener,
          "accept",
          resolvesNext([
            Promise.reject("fake-tcp-listener-accept-error"),
          ]),
        );

        const iterator = listener[Symbol.asyncIterator]();
        const error = await assertRejects(() => iterator.next());

        assertEquals(error, "fake-tcp-listener-accept-error");
        assertSpyCalls(listener_accept, 1);
      });

      await t.step(
        "returns the closed iterator after .close() calls",
        async () => {
          listener.close();

          const iterator = listener[Symbol.asyncIterator]();
          const result = await iterator.next();

          assertEquals(result, { done: true, value: undefined });
        },
      );
    });

    await t.step("[Symbol.dispose]()", async (t) => {
      const listener = createFakeTcpListener();
      const listener_close = spy(listener, "close");

      await t.step("calls .close()", () => {
        assertSpyCalls(listener_close, 0);

        listener[Symbol.dispose]();

        assertSpyCalls(listener_close, 1);
      });

      await t.step("does not calls .close() if already closed", () => {
        assertSpyCalls(listener_close, 1);

        listener[Symbol.dispose]();

        assertSpyCalls(listener_close, 1);
      });
    });
  });
});

Deno.test("createFakeTcpConn()", async (t) => {
  await t.step("returns a TcpConn like object", async (t) => {
    const conn = createFakeTcpConn();

    await t.step("has own key", async (t) => {
      const keys = Reflect.ownKeys(
        {
          localAddr: 0,
          remoteAddr: 0,
          readable: 0,
          writable: 0,
          rid: 0,
          ref: 0,
          unref: 0,
          setNoDelay: 0,
          setKeepAlive: 0,
          read: 0,
          write: 0,
          close: 0,
          closeWrite: 0,
          [Symbol.dispose]: 0,
        } as const satisfies Record<
          // NOTE: 'rid' is removed from Deno v2
          keyof { rid: unknown } & Deno.TcpConn,
          0
        >,
      );
      for (const key of keys) {
        await t.step(key.toString(), () => {
          assert(key in conn);
        });
      }
    });

    await t.step("unimplements", async (t) => {
      const unimplementedProps = [
        "localAddr",
        "remoteAddr",
        "rid",
        "readable",
        "writable",
      ] as const satisfies readonly GetterKeyOf<
        // NOTE: 'rid' is removed from Deno v2
        { rid: unknown } & Deno.TcpConn
      >[];
      for (const key of unimplementedProps) {
        await t.step(`.${key}`, () => {
          assertThrows(() => conn[key], Error, "Unimplemented");
        });
      }

      const unimplementedMethods = [
        "ref",
        "unref",
        "setNoDelay",
        "setKeepAlive",
        "read",
        "write",
        "close",
        "closeWrite",
      ] as const satisfies readonly MethodKeyOf<Deno.TcpConn>[];
      for (const key of unimplementedMethods) {
        await t.step(`.${key}()`, () => {
          assertThrows(() => (conn[key] as AnyFn)(), Error, "Unimplemented");
        });
      }
    });

    await t.step("[Symbol.dispose]()", async (t) => {
      await t.step("calls .close()", () => {
        using listener_close = stub(conn, "close");
        assertSpyCalls(listener_close, 0);

        conn[Symbol.dispose]();

        assertSpyCalls(listener_close, 1);
      });

      await t.step("does not throws if .close() throws", () => {
        using listener_close = stub(conn, "close", () => {
          throw "fake-close-throws-a-error";
        });
        assertSpyCalls(listener_close, 0);

        conn[Symbol.dispose]();

        assertSpyCalls(listener_close, 1);
      });
    });
  });
});

Deno.test("createFakeWorker()", async (t) => {
  await t.step("returns a Worker like object", async (t) => {
    const worker = createFakeWorker();

    await t.step("has own key", async (t) => {
      const keys = Reflect.ownKeys(
        {
          onerror: 0,
          onmessage: 0,
          onmessageerror: 0,
          postMessage: 0,
          addEventListener: 0,
          removeEventListener: 0,
          dispatchEvent: 0,
          terminate: 0,
        } as const satisfies Record<keyof Worker, 0>,
      );
      for (const key of keys) {
        await t.step(key.toString(), () => {
          assert(key in worker);
        });
      }
    });

    await t.step("unimplements", async (t) => {
      const unimplementedMethods = [
        "onerror",
        "onmessage",
        "onmessageerror",
        "postMessage",
        "addEventListener",
        "removeEventListener",
        "dispatchEvent",
        "terminate",
      ] as const satisfies readonly MethodKeyOf<Worker>[];
      for (const key of unimplementedMethods) {
        await t.step(`.${key}()`, () => {
          assertThrows(() => (worker[key] as AnyFn)(), Error, "Unimplemented");
        });
      }
    });
  });
});
