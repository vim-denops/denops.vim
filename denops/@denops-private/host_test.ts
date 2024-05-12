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
