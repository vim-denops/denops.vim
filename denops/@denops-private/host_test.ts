import { assertThrows, unimplemented } from "jsr:@std/assert@0.225.1";
import {
  assertSpyCall,
  assertSpyCalls,
  stub,
} from "jsr:@std/testing@0.224.0/mock";
import { AssertError } from "jsr:@core/unknownutil@3.18.1";
import { invoke, type Service } from "./host.ts";

Deno.test("invoke", async (t) => {
  const service: Omit<Service, "bind"> = {
    load: () => unimplemented(),
    unload: () => unimplemented(),
    reload: () => unimplemented(),
    dispatch: () => unimplemented(),
    dispatchAsync: () => unimplemented(),
    close: () => unimplemented(),
  };

  await t.step("calls 'load'", async (t) => {
    await t.step("ok", async () => {
      using service_load = stub(service, "load");
      await invoke(service, "load", ["dummy", "dummy.ts"]);
      assertSpyCalls(service_load, 1);
      assertSpyCall(service_load, 0, { args: ["dummy", "dummy.ts"] });
    });

    await t.step("ok with options", async () => {
      using service_load = stub(service, "load");
      await invoke(service, "load", ["dummy", "dummy.ts", {
        forceReload: true,
      }]);
      assertSpyCalls(service_load, 1);
      assertSpyCall(service_load, 0, {
        args: ["dummy", "dummy.ts", { forceReload: true }],
      });
    });

    await t.step("invalid args", () => {
      using service_load = stub(service, "load");
      assertThrows(() => invoke(service, "load", []), AssertError);
      assertSpyCalls(service_load, 0);
    });

    await t.step("invalid options", () => {
      using service_load = stub(service, "load");
      assertThrows(
        () =>
          invoke(service, "load", ["dummy", "dummy.ts", {
            forceReload: "foo",
          }]),
        AssertError,
      );
      assertSpyCalls(service_load, 0);
    });
  });

  await t.step("calls 'unload'", async (t) => {
    await t.step("ok", async () => {
      using service_load = stub(service, "unload");
      await invoke(service, "unload", ["dummy"]);
      assertSpyCalls(service_load, 1);
      assertSpyCall(service_load, 0, { args: ["dummy"] });
    });

    await t.step("invalid args", () => {
      using service_load = stub(service, "unload");
      assertThrows(() => invoke(service, "unload", []), AssertError);
      assertSpyCalls(service_load, 0);
    });
  });

  await t.step("calls 'reload'", async (t) => {
    await t.step("ok", async () => {
      using service_reload = stub(service, "reload");
      await invoke(service, "reload", ["dummy"]);
      assertSpyCalls(service_reload, 1);
      assertSpyCall(service_reload, 0, { args: ["dummy"] });
    });

    await t.step("ok with options", async () => {
      using service_load = stub(service, "reload");
      await invoke(service, "reload", ["dummy", { forceReload: true }]);
      assertSpyCalls(service_load, 1);
      assertSpyCall(service_load, 0, {
        args: ["dummy", { forceReload: true }],
      });
    });

    await t.step("invalid args", () => {
      using service_reload = stub(service, "reload");
      assertThrows(() => invoke(service, "reload", []), AssertError);
      assertSpyCalls(service_reload, 0);
    });

    await t.step("invalid options", () => {
      using service_load = stub(service, "reload");
      assertThrows(
        () => invoke(service, "reload", ["dummy", { forceReload: 123 }]),
        AssertError,
      );
      assertSpyCalls(service_load, 0);
    });
  });

  await t.step("calls 'dispatch'", async (t) => {
    await t.step("ok", async () => {
      using service_dispatch = stub(service, "dispatch");
      await invoke(service, "dispatch", ["dummy", "fn", ["args"]]);
      assertSpyCalls(service_dispatch, 1);
      assertSpyCall(service_dispatch, 0, { args: ["dummy", "fn", ["args"]] });
    });

    await t.step("invalid args", () => {
      using service_dispatch = stub(service, "dispatch");
      assertThrows(() => invoke(service, "dispatch", []), AssertError);
      assertSpyCalls(service_dispatch, 0);
    });
  });

  await t.step("calls 'dispatchAsync'", async (t) => {
    await t.step("ok", async () => {
      using service_dispatchAsync = stub(service, "dispatchAsync");
      await invoke(service, "dispatchAsync", [
        "dummy",
        "fn",
        ["args"],
        "success",
        "failure",
      ]);
      assertSpyCalls(service_dispatchAsync, 1);
      assertSpyCall(service_dispatchAsync, 0, {
        args: ["dummy", "fn", ["args"], "success", "failure"],
      });
    });

    await t.step("invalid args", () => {
      using service_dispatchAsync = stub(service, "dispatchAsync");
      assertThrows(() => invoke(service, "dispatchAsync", []), AssertError);
      assertSpyCalls(service_dispatchAsync, 0);
    });
  });

  await t.step("calls 'close'", async (t) => {
    await t.step("ok", async () => {
      using service_dispatch = stub(service, "close");
      await invoke(service, "close", []);
      assertSpyCalls(service_dispatch, 1);
      assertSpyCall(service_dispatch, 0, { args: [] });
    });

    await t.step("invalid args", () => {
      using service_dispatch = stub(service, "close");
      assertThrows(() => invoke(service, "close", ["foo"]), AssertError);
      assertSpyCalls(service_dispatch, 0);
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
