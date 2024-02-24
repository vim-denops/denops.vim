import { assertThrows } from "https://deno.land/std@0.217.0/assert/mod.ts";
import {
  assertSpyCall,
  assertSpyCalls,
  stub,
} from "https://deno.land/std@0.217.0/testing/mock.ts";
import { AssertError } from "https://deno.land/x/unknownutil@v3.16.3/mod.ts";
import { invoke, Service } from "./host.ts";
import { unimplemented } from "https://deno.land/x/errorutil@v0.1.1/mod.ts";

Deno.test("invoke", async (t) => {
  const service: Omit<Service, "bind"> = {
    load: () => unimplemented(),
    reload: () => unimplemented(),
    dispatch: () => unimplemented(),
    dispatchAsync: () => unimplemented(),
  };

  await t.step("calls 'load'", async (t) => {
    await t.step("ok", async () => {
      const s = stub(service, "load");
      try {
        await invoke(service, "load", ["dummy", "dummy.ts"]);
        assertSpyCalls(s, 1);
        assertSpyCall(s, 0, { args: ["dummy", "dummy.ts"] });
      } finally {
        s.restore();
      }
    });

    await t.step("invalid args", () => {
      const s = stub(service, "load");
      try {
        assertThrows(() => invoke(service, "load", []), AssertError);
        assertSpyCalls(s, 0);
      } finally {
        s.restore();
      }
    });
  });

  await t.step("calls 'reload'", async (t) => {
    await t.step("ok", async () => {
      const s = stub(service, "reload");
      try {
        await invoke(service, "reload", ["dummy"]);
        assertSpyCalls(s, 1);
        assertSpyCall(s, 0, { args: ["dummy"] });
      } finally {
        s.restore();
      }
    });

    await t.step("invalid args", () => {
      const s = stub(service, "reload");
      try {
        assertThrows(() => invoke(service, "reload", []), AssertError);
        assertSpyCalls(s, 0);
      } finally {
        s.restore();
      }
    });
  });

  await t.step("calls 'dispatch'", async (t) => {
    await t.step("ok", async () => {
      const s = stub(service, "dispatch");
      try {
        await invoke(service, "dispatch", ["dummy", "fn", ["args"]]);
        assertSpyCalls(s, 1);
        assertSpyCall(s, 0, { args: ["dummy", "fn", ["args"]] });
      } finally {
        s.restore();
      }
    });

    await t.step("invalid args", () => {
      const s = stub(service, "dispatch");
      try {
        assertThrows(() => invoke(service, "dispatch", []), AssertError);
        assertSpyCalls(s, 0);
      } finally {
        s.restore();
      }
    });
  });

  await t.step("calls 'dispatchAsync'", async (t) => {
    await t.step("ok", async () => {
      const s = stub(service, "dispatchAsync");
      try {
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
      } finally {
        s.restore();
      }
    });

    await t.step("invalid args", () => {
      const s = stub(service, "dispatchAsync");
      try {
        assertThrows(() => invoke(service, "dispatchAsync", []), AssertError);
        assertSpyCalls(s, 0);
      } finally {
        s.restore();
      }
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
