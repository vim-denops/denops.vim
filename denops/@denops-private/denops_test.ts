import { BatchError, type Meta } from "jsr:@denops/core@7.0.0";
import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
  unimplemented,
} from "jsr:@std/assert@1.0.1";
import {
  assertSpyCallArgs,
  assertSpyCalls,
  resolvesNext,
  stub,
} from "jsr:@std/testing@0.224.0/mock";
import { promiseState } from "jsr:@lambdalisue/async@2.1.1";
import { DenopsImpl, type Host, type Service } from "./denops.ts";

type BatchReturn = [results: unknown[], errmsg: string];

Deno.test("DenopsImpl", async (t) => {
  const meta: Meta = {
    mode: "release",
    host: "vim",
    version: "dev",
    platform: "linux",
  };
  const host: Host = {
    redraw: () => unimplemented(),
    call: () => unimplemented(),
    batch: () => unimplemented(),
  };
  const service: Service = {
    dispatch: () => unimplemented(),
    waitLoaded: () => unimplemented(),
    interrupted: new AbortController().signal,
  };
  const denops = new DenopsImpl("dummy", meta, host, service);

  await t.step("interrupted returns AbortSignal instance", () => {
    assertInstanceOf(denops.interrupted, AbortSignal);
  });

  await t.step(".redraw()", async (t) => {
    await t.step("calls host.redraw() without `force`", async () => {
      using host_redraw = stub(host, "redraw", resolvesNext([undefined]));

      await denops.redraw();

      assertSpyCallArgs(host_redraw, 0, [undefined]);
    });

    await t.step("calls host.redraw() with `force=false`", async () => {
      using host_redraw = stub(host, "redraw", resolvesNext([undefined]));

      await denops.redraw(false);

      assertSpyCallArgs(host_redraw, 0, [false]);
    });

    await t.step("calls host.redraw() with `force=true`", async () => {
      using host_redraw = stub(host, "redraw", resolvesNext([undefined]));

      await denops.redraw(true);

      assertSpyCallArgs(host_redraw, 0, [true]);
    });
  });

  await t.step(".call()", async (t) => {
    await t.step("calls host.call() without `args`", async () => {
      using host_call = stub(host, "call", resolvesNext([1]));

      await denops.call("bufnr");

      assertSpyCallArgs(host_call, 0, ["bufnr"]);
    });

    await t.step("calls host.call() with one `args`", async () => {
      using host_call = stub(host, "call", resolvesNext([4]));

      await denops.call("abs", -4);

      assertSpyCallArgs(host_call, 0, ["abs", -4]);
    });

    await t.step("calls host.call() with multiple `args`", async () => {
      using host_call = stub(host, "call", resolvesNext([-1]));

      await denops.call("byteidx", "foobar", 42, false);

      assertSpyCallArgs(host_call, 0, ["byteidx", "foobar", 42, false]);
    });

    await t.step(
      "calls host.call() with `args` omitting after `undefined`",
      async () => {
        using host_call = stub(host, "call", resolvesNext([3]));

        await denops.call("charidx", "foobar", 3, undefined, false);

        assertSpyCallArgs(host_call, 0, ["charidx", "foobar", 3]);
      },
    );

    await t.step("resolves a result of host.call()", async () => {
      using _host_call = stub(host, "call", resolvesNext([42]));

      const actual = await denops.call("bufnr");

      assertEquals(actual, 42);
    });

    await t.step("if host.call() rejects with an error", async (t) => {
      await t.step("rejects with an error", async () => {
        const error = new Error("test error in host.call");
        using _host_call = stub(host, "call", resolvesNext([error]));

        const actual = await assertRejects(
          () => denops.call("foo", true),
        );
        assertStrictEquals(actual, error);
      });
    });
  });

  await t.step(".batch()", async (t) => {
    await t.step("calls host.batch() with `calls`", async () => {
      using host_batch = stub(
        host,
        "batch",
        resolvesNext<BatchReturn>([[[4, 10, 9], ""]]),
      );

      await denops.batch(["abs", -4], ["abs", 10], ["abs", -9]);

      assertSpyCallArgs(host_batch, 0, [["abs", -4], ["abs", 10], ["abs", -9]]);
    });

    await t.step(
      "calls host.batch() with `calls` omitting arguments after `undefined`",
      async () => {
        using host_batch = stub(
          host,
          "batch",
          resolvesNext<BatchReturn>([[["", ""], ""]]),
        );

        await denops.batch(
          ["findfile", "foo", undefined, 42],
          ["getreg", undefined, 1, true],
        );

        assertSpyCallArgs(host_batch, 0, [["findfile", "foo"], ["getreg"]]);
      },
    );

    await t.step("resolves results of host.batch()", async () => {
      using _host_batch = stub(
        host,
        "batch",
        resolvesNext<BatchReturn>([[[4, 10, 9], ""]]),
      );

      const actual = await denops.batch(["abs", -4], ["abs", 10], ["abs", -9]);

      assertEquals(actual, [4, 10, 9]);
    });

    await t.step(
      "if host.batch() resolves with an error message",
      async (t) => {
        await t.step("rejects with BatchError", async () => {
          using _host_batch = stub(
            host,
            "batch",
            resolvesNext<BatchReturn>([[[], "test error in host.batch"]]),
          );

          await assertRejects(
            () => denops.batch(["foo", true]),
            BatchError,
            "test error in host.batch",
          );
        });
      },
    );

    await t.step("if host.batch() rejects with an error", async (t) => {
      await t.step("rejects with an error", async () => {
        const error = new Error("test error in host.batch");
        using _host_batch = stub(
          host,
          "batch",
          resolvesNext<BatchReturn>([error]),
        );

        const actual = await assertRejects(
          () => denops.batch(["foo", true]),
        );
        assertStrictEquals(actual, error);
      });
    });
  });

  await t.step(".cmd()", async (t) => {
    await t.step("calls host.call() without `ctx`", async () => {
      using host_call = stub(host, "call", resolvesNext([undefined]));

      await denops.cmd("echo 'foo'");

      assertSpyCallArgs(host_call, 0, ["denops#api#cmd", "echo 'foo'", {}]);
    });

    await t.step("calls host.call() with `ctx`", async () => {
      using host_call = stub(host, "call", resolvesNext([undefined]));

      await denops.cmd("echo 'foo'", { bar: 1, qux: true });

      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "echo 'foo'",
        { bar: 1, qux: true },
      ]);
    });

    await t.step("if host.call() rejects with an error", async (t) => {
      await t.step("rejects with an error", async () => {
        const error = new Error("test error in host.call");
        using _host_call = stub(host, "call", resolvesNext([error]));

        const actual = await assertRejects(
          () => denops.cmd("echo 'foo'"),
        );
        assertStrictEquals(actual, error);
      });
    });
  });

  await t.step(".eval()", async (t) => {
    await t.step("calls host.call() without `ctx`", async () => {
      using host_call = stub(host, "call", resolvesNext([undefined]));

      await denops.eval("v:version");

      assertSpyCallArgs(host_call, 0, ["denops#api#eval", "v:version", {}]);
    });

    await t.step("calls host.call() with `ctx`", async () => {
      using host_call = stub(host, "call", resolvesNext([undefined]));

      await denops.eval("v:version", { foo: 1, bar: true });

      assertSpyCallArgs(host_call, 0, [
        "denops#api#eval",
        "v:version",
        { foo: 1, bar: true },
      ]);
    });

    await t.step("resolves a result of host.call()", async () => {
      using _host_call = stub(host, "call", resolvesNext([901]));

      const actual = await denops.eval("v:version");

      assertEquals(actual, 901);
    });

    await t.step("if host.call() rejects with an error", async (t) => {
      await t.step("rejects with an error", async () => {
        const error = new Error("test error in host.call");
        using _host_call = stub(host, "call", resolvesNext([error]));

        const actual = await assertRejects(
          () => denops.eval("v:version"),
        );
        assertStrictEquals(actual, error);
      });
    });
  });

  await t.step(".dispatch()", async (t) => {
    await t.step("if the plugin is already loaded", async (t) => {
      await t.step("calls service.dispatch() without `args`", async () => {
        using _service_waitLoaded = stub(
          service,
          "waitLoaded",
          resolvesNext([undefined]),
        );
        using service_dispatch = stub(
          service,
          "dispatch",
          resolvesNext([undefined]),
        );

        await denops.dispatch("dummy", "fn");

        assertSpyCallArgs(service_dispatch, 0, ["dummy", "fn", []]);
      });

      await t.step("calls service.dispatch() with `args`", async () => {
        using _service_waitLoaded = stub(
          service,
          "waitLoaded",
          resolvesNext([undefined]),
        );
        using service_dispatch = stub(
          service,
          "dispatch",
          resolvesNext([undefined]),
        );

        await denops.dispatch(
          "dummy",
          "fn",
          "args0",
          undefined,
          null,
          true,
          42,
        );

        assertSpyCallArgs(service_dispatch, 0, [
          "dummy",
          "fn",
          ["args0", undefined, null, true, 42],
        ]);
      });

      await t.step("resolves result of service.dispatch()", async () => {
        using _service_waitLoaded = stub(
          service,
          "waitLoaded",
          resolvesNext([undefined]),
        );
        using _service_dispatch = stub(
          service,
          "dispatch",
          resolvesNext([{ foo: "a", bar: 42, qux: true }]),
        );

        const actual = await denops.dispatch("dummy", "fn");

        assertEquals(actual, { foo: "a", bar: 42, qux: true });
      });
    });

    await t.step("if the plugin is not yet loaded", async (t) => {
      await t.step("waits service.waitLoaded() resolves", async () => {
        const waiter = Promise.withResolvers<void>();
        using service_waitLoaded = stub(
          service,
          "waitLoaded",
          resolvesNext([waiter.promise]),
        );
        using service_dispatch = stub(
          service,
          "dispatch",
          resolvesNext([undefined]),
        );

        const dispatchPromise = denops.dispatch("dummy", "fn", "args");

        assertEquals(await promiseState(dispatchPromise), "pending");
        assertSpyCalls(service_waitLoaded, 1);
        assertSpyCalls(service_dispatch, 0);
        waiter.resolve();
        assertEquals(await promiseState(dispatchPromise), "fulfilled");
        assertSpyCalls(service_waitLoaded, 1);
        assertSpyCalls(service_dispatch, 1);
      });
    });

    await t.step("if the service is closed", async (t) => {
      await t.step("rejects and service.dispatch() never calls", async () => {
        using service_waitLoaded = stub(
          service,
          "waitLoaded",
          resolvesNext<void>([new Error("Service closed")]),
        );
        using service_dispatch = stub(
          service,
          "dispatch",
          resolvesNext([undefined]),
        );

        await assertRejects(
          () => denops.dispatch("dummy", "fn"),
          Error,
          "Service closed",
        );
        assertSpyCallArgs(service_waitLoaded, 0, ["dummy"]);
        assertSpyCalls(service_dispatch, 0);
      });
    });
  });
});
