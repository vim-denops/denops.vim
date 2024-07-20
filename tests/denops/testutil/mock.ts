import { AssertionError, unimplemented } from "jsr:@std/assert@0.225.2";
import type { Meta } from "jsr:@denops/core@7.0.0";

/** Returns a Promise that is never resolves or rejects. */
export function pendingPromise(): Promise<never> {
  return new Promise<never>(() => {});
}

/** Returns a fake `TcpListener` instance. */
export function createFakeTcpListener(): Deno.TcpListener {
  let closeWaiter: PromiseWithResolvers<never> | undefined = Promise
    .withResolvers();
  closeWaiter.promise.catch(() => {});
  return {
    get addr(): Deno.NetAddr {
      return unimplemented();
    },
    get rid() {
      return unimplemented();
    },
    ref: () => unimplemented(),
    unref: () => unimplemented(),
    accept: () => pendingPromise(),
    close() {
      // NOTE: Listener.close() throws if already closed.
      if (closeWaiter == null) {
        throw new AssertionError("fake-tcp-listner-already-closed");
      }
      closeWaiter.reject("listener-closed");
      closeWaiter = undefined;
    },
    async *[Symbol.asyncIterator]() {
      // NOTE: Listener[@@asyncIterator]() returns immediately if already closed.
      if (closeWaiter == null) {
        return;
      }
      try {
        for (;;) {
          yield Promise.race([this.accept(), closeWaiter.promise]);
        }
      } catch (e) {
        if (e !== "listener-closed") {
          throw e;
        }
      }
    },
    [Symbol.dispose]() {
      // NOTE: Listener[@@dispose]() does not calls .close() if already closed.
      if (closeWaiter != null) {
        this.close();
      }
    },
  };
}

/** Returns a fake `TcpConn` instance. */
export function createFakeTcpConn(): Deno.TcpConn {
  return {
    get localAddr() {
      return unimplemented();
    },
    get remoteAddr() {
      return unimplemented();
    },
    get rid() {
      return unimplemented();
    },
    get readable() {
      return unimplemented();
    },
    get writable() {
      return unimplemented();
    },
    ref: () => unimplemented(),
    unref: () => unimplemented(),
    setNoDelay: () => unimplemented(),
    setKeepAlive: () => unimplemented(),
    read: () => unimplemented(),
    write: () => unimplemented(),
    close: () => unimplemented(),
    closeWrite: () => unimplemented(),
    [Symbol.dispose]() {
      try {
        this.close();
      } catch {
        // NOTE: TcpConn[@@dispose]() does not throws if already closed.
      }
    },
  };
}

/** Returns a fake `Worker` instance. */
export function createFakeWorker(): Worker {
  return {
    onerror: () => unimplemented(),
    onmessage: () => unimplemented(),
    onmessageerror: () => unimplemented(),
    postMessage: () => unimplemented(),
    addEventListener: () => unimplemented(),
    removeEventListener: () => unimplemented(),
    dispatchEvent: () => unimplemented(),
    terminate: () => unimplemented(),
  };
}

/** Returns as fake `Meta` object. */
export function createFakeMeta(): Meta {
  return {
    mode: "test",
    host: "vim",
    version: "9.1.457",
    platform: "linux",
  };
}
