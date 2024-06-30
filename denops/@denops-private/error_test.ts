import {
  assert,
  assertEquals,
  assertInstanceOf,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { is } from "https://deno.land/x/unknownutil@v3.18.1/mod.ts";
import { errorDeserializer, errorSerializer } from "./error.ts";

Deno.test("errorSerializer", async (t) => {
  await t.step("serializes Error", () => {
    const err = new Error("error message");
    const ret = errorSerializer(err);
    assert(is.String(ret));
    assertEquals({ ...JSON.parse(ret), stack: "stack" }, {
      attributes: {},
      message: "error message",
      name: "Error",
      proto: "Error",
      stack: "stack",
    });
  });

  await t.step("serializes String", () => {
    const err = "error message";
    const ret = errorSerializer(err);
    assert(is.String(ret));
    assertEquals(ret, "error message");
  });

  await t.step("serializes Object", () => {
    const err = {
      type: "error",
      message: "error message",
    };
    const ret = errorSerializer(err);
    assert(is.String(ret));
    assertEquals(JSON.parse(ret), {
      type: "error",
      message: "error message",
    });
  });
});

Deno.test("errorDeserializer", async (t) => {
  await t.step("deserializes String (Error)", () => {
    const err = errorSerializer(new Error("error message"));
    const ret = errorDeserializer(err);
    assertInstanceOf(ret, Error);
    assertEquals(ret.name, "Error");
    assertEquals(ret.message, "error message");
  });

  await t.step("deserializes String (Object)", () => {
    const err = errorSerializer({
      type: "error",
      message: "error message",
    });
    const ret = errorDeserializer(err);
    assertInstanceOf(ret, Object);
    assertEquals(ret, {
      type: "error",
      message: "error message",
    });
  });

  await t.step("deserializes Object", () => {
    const err = {
      type: "error",
      message: "error message",
    };
    const ret = errorDeserializer(err);
    assertEquals(ret, {
      type: "error",
      message: "error message",
    });
  });
});
