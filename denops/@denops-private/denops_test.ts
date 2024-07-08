import type { Meta } from "jsr:@denops/core@7.0.0-pre1";
import { assertEquals, assertInstanceOf } from "jsr:@std/assert@0.225.1";
import { assertSpyCall, stub } from "jsr:@std/testing@0.224.0/mock";
import { promiseState } from "jsr:@lambdalisue/async@2.1.1";
import { unimplemented } from "jsr:@lambdalisue/errorutil@1.0.0";
import { DenopsImpl, type Host, type Service } from "./denops.ts";

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

  await t.step("redraw() calls host.redraw()", async () => {
    using s = stub(host, "redraw");
    await denops.redraw();
    assertSpyCall(s, 0, { args: [undefined] });

    await denops.redraw(false);
    assertSpyCall(s, 1, { args: [false] });

    await denops.redraw(true);
    assertSpyCall(s, 2, { args: [true] });
  });

  await t.step("call() calls host.call()", async () => {
    using s = stub(host, "call");
    await denops.call("abs", -4);
    assertSpyCall(s, 0, { args: ["abs", -4] });

    await denops.call("abs", 10);
    assertSpyCall(s, 1, { args: ["abs", 10] });
  });

  await t.step("batch() calls host.batch()", async () => {
    using s = stub(
      host,
      "batch",
      () => Promise.resolve([[], ""] as [unknown[], string]),
    );
    await denops.batch(["abs", -4], ["abs", 10], ["abs", -9]);
    assertSpyCall(s, 0, {
      args: [["abs", -4], ["abs", 10], ["abs", -9]],
    });
  });

  await t.step("cmd() calls host.call()", async () => {
    using s = stub(host, "call");
    await denops.cmd("echo 'foo'");
    assertSpyCall(s, 0, {
      args: ["denops#api#cmd", "echo 'foo'", {}],
    });
  });

  await t.step("eval() calls host.call()", async () => {
    using s = stub(host, "call");
    await denops.eval("v:version");
    assertSpyCall(s, 0, {
      args: ["denops#api#eval", "v:version", {}],
    });
  });

  await t.step("dispatch() calls service.dispatch()", async () => {
    using s1 = stub(service, "waitLoaded", () => Promise.resolve());
    using s2 = stub(service, "dispatch", () => Promise.resolve());
    await denops.dispatch("dummy", "fn", "args");
    assertSpyCall(s1, 0, {
      args: ["dummy"],
    });
    assertSpyCall(s2, 0, {
      args: ["dummy", "fn", ["args"]],
    });
  });

  await t.step(
    "dispatch() internally waits 'service.waitLoaded()' before 'service.dispatch()'",
    async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      using s1 = stub(service, "waitLoaded", () => promise);
      using s2 = stub(service, "dispatch", () => Promise.resolve());
      const p = denops.dispatch("dummy", "fn", "args");
      assertEquals(await promiseState(p), "pending");
      assertEquals(s1.calls.length, 1);
      assertEquals(s2.calls.length, 0);
      resolve();
      assertEquals(await promiseState(p), "fulfilled");
      assertEquals(s1.calls.length, 1);
      assertEquals(s2.calls.length, 1);
    },
  );
});
