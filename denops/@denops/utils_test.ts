import { assertThrows } from "./deps_test.ts";
import {
  ensureArray,
  ensureNumber,
  ensureRecord,
  ensureString,
} from "./utils.ts";

Deno.test("ensureString does nothing on string", () => {
  ensureString("Hello");
});
Deno.test("ensureString throws error on non string value", () => {
  assertThrows(() => ensureString(0));
  assertThrows(() => ensureString([]));
  assertThrows(() => ensureString({}));
  assertThrows(() => ensureString(undefined));
  assertThrows(() => ensureString(null));
});

Deno.test("ensureNumber does nothing on number", () => {
  ensureNumber(0);
  ensureNumber(0.0);
});
Deno.test("ensureNumber throws error on non number value", () => {
  assertThrows(() => ensureNumber("Hello"));
  assertThrows(() => ensureNumber([]));
  assertThrows(() => ensureNumber({}));
  assertThrows(() => ensureNumber(undefined));
  assertThrows(() => ensureNumber(null));
});

Deno.test("ensureArray does nothing on array", () => {
  ensureArray([]);
  ensureArray([0, 1, 2]);
  ensureArray(["a", "b", "c"]);
});
Deno.test("ensureArray throws error on non array value", () => {
  assertThrows(() => ensureArray("Hello"));
  assertThrows(() => ensureArray(0));
  assertThrows(() => ensureArray({}));
  assertThrows(() => ensureArray(undefined));
  assertThrows(() => ensureArray(null));
});

Deno.test("ensureRecord does nothing on record", () => {
  ensureRecord({});
  ensureRecord({ "a": "a", "b": "b" });
});
Deno.test("ensureRecord throws error on non record value", () => {
  assertThrows(() => ensureRecord("Hello"));
  assertThrows(() => ensureRecord(0));
  assertThrows(() => ensureRecord([]));
  assertThrows(() => ensureRecord(undefined));
  assertThrows(() => ensureRecord(null));
});
