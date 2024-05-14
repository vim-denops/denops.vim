import { assertThrows } from "jsr:@std/assert@0.225.1";
import {
  assertSpyCall,
  assertSpyCalls,
  stub,
} from "jsr:@std/testing@0.224.0/mock";
import { AssertError } from "jsr:@core/unknownutil@3.18.0";
import { unimplemented } from "jsr:@lambdalisue/errorutil@1.0.0";
import { invoke, type Service } from "./host.ts";

Deno.test("invoke", async (t) => {
  const service: Omit<Service, "bind"> = {
    load: () => unimplemented(),
    reload: () => unimplemented(),
    interrupt: () => unimplemented(),
    dispatch: () => unimplemented(),
    dispatchAsync: () => unimplemented(),
  };

  await t.step("calls 'load'", async (t) => {
    await t.step("ok", async () => {
      using s = stub(service, "load");
      await invoke(service, "load", ["dummy", "dummy.ts"]);
      assertSpyCalls(s, 1);
      assertSpyCall(s, 0, { args: ["dummy", "dummy.ts"] });
    });

    await t.step("invalid args", () => {
      using s = stub(service, "load");
      assertThrows(() => invoke(service, "load", []), AssertError);
      assertSpyCalls(s, 0);
    });
  });

  await t.step("calls 'reload'", async (t) => {
    await t.step("ok", async () => {
      using s = stub(service, "reload");
      await invoke(service, "reload", ["dummy"]);
      assertSpyCalls(s, 1);
      assertSpyCall(s, 0, { args: ["dummy"] });
    });

    await t.step("invalid args", () => {
      using s = stub(service, "reload");
      assertThrows(() => invoke(service, "reload", []), AssertError);
      assertSpyCalls(s, 0);
    });
  });

  await t.step("calls 'interrupt'", async (t) => {
    await t.step("ok", async () => {
      using s = stub(service, "interrupt");
      await invoke(service, "interrupt", []);
      assertSpyCalls(s, 1);
      assertSpyCall(s, 0, { args: [] });
    });

    await t.step("ok (with reason)", async () => {
      using s = stub(service, "interrupt");
      await invoke(service, "interrupt", ["reason"]);
      assertSpyCalls(s, 1);
      assertSpyCall(s, 0, { args: ["reason"] });
    });

    await t.step("invalid args", () => {
      using s = stub(service, "interrupt");
      assertThrows(() => invoke(service, "interrupt", ["a", "b"]), AssertError);
      assertSpyCalls(s, 0);
    });
  });

  await t.step("calls 'dispatch'", async (t) => {
    await t.step("ok", async () => {
      using s = stub(service, "dispatch");
      await invoke(service, "dispatch", ["dummy", "fn", ["args"]]);
      assertSpyCalls(s, 1);
      assertSpyCall(s, 0, { args: ["dummy", "fn", ["args"]] });
    });

    await t.step("invalid args", () => {
      using s = stub(service, "dispatch");
      assertThrows(() => invoke(service, "dispatch", []), AssertError);
      assertSpyCalls(s, 0);
    });
  });

  await t.step("calls 'dispatchAsync'", async (t) => {
    await t.step("ok", async () => {
      using s = stub(service, "dispatchAsync");
      await invoke(service, "dispatchAsync", [
        "dummy",
        "fn",
        ["args"],
        "success",
        "failure",
      ]);
      assertSpyCalls(s, 1);
      assertSpyCall(s, 0, {
        args: ["dummy", "fn", ["args"], "success", "failure"],
      });
    });

    await t.step("invalid args", () => {
      using s = stub(service, "dispatchAsync");
      assertThrows(() => invoke(service, "dispatchAsync", []), AssertError);
      assertSpyCalls(s, 0);
    });
  });

  await t.step("calls unknown method", () => {
    assertThrows(
      () => invoke(service, "unknown-method", []),
      Error,
      "does not have a method",
    );
  });
});
