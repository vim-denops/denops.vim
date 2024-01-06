import type { Meta } from "https://deno.land/x/denops_core@v5.0.0/mod.ts";
import {
  assertSpyCall,
  stub,
} from "https://deno.land/std@0.211.0/testing/mock.ts";
import { DenopsImpl, Host, Service } from "./denops.ts";
import { unimplemented } from "https://deno.land/x/errorutil@v0.1.1/mod.ts";

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
  };
  const denops = new DenopsImpl("dummy", meta, host, service);

  await t.step("redraw() calls host.redraw()", async () => {
    const s = stub(host, "redraw");
    try {
      await denops.redraw();
      assertSpyCall(s, 0, { args: [undefined] });

      await denops.redraw(false);
      assertSpyCall(s, 1, { args: [false] });

      await denops.redraw(true);
      assertSpyCall(s, 2, { args: [true] });
    } finally {
      s.restore();
    }
  });

  await t.step("call() calls host.call()", async () => {
    const s = stub(host, "call");
    try {
      await denops.call("abs", -4);
      assertSpyCall(s, 0, { args: ["abs", -4] });

      await denops.call("abs", 10);
      assertSpyCall(s, 1, { args: ["abs", 10] });
    } finally {
      s.restore();
    }
  });

  await t.step("batch() calls host.batch()", async () => {
    const s = stub(
      host,
      "batch",
      () => Promise.resolve([[], ""] as [unknown[], string]),
    );
    try {
      await denops.batch(["abs", -4], ["abs", 10], ["abs", -9]);
      assertSpyCall(s, 0, {
        args: [["abs", -4], ["abs", 10], ["abs", -9]],
      });
    } finally {
      s.restore();
    }
  });

  await t.step("cmd() calls host.call()", async () => {
    const s = stub(host, "call");
    try {
      await denops.cmd("echo 'foo'");
      assertSpyCall(s, 0, {
        args: ["denops#api#cmd", "echo 'foo'", {}],
      });
    } finally {
      s.restore();
    }
  });

  await t.step("eval() calls host.call()", async () => {
    const s = stub(host, "call");
    try {
      await denops.eval("v:version");
      assertSpyCall(s, 0, {
        args: ["denops#api#eval", "v:version", {}],
      });
    } finally {
      s.restore();
    }
  });

  await t.step("dispatch() calls service.dispatch()", async () => {
    const s = stub(service, "dispatch");
    try {
      await denops.dispatch("dummy", "fn", "args");
      assertSpyCall(s, 0, {
        args: ["dummy", "fn", ["args"]],
      });
    } finally {
      s.restore();
    }
  });
});
