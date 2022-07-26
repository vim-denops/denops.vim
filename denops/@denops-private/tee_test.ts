import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.149.0/testing/asserts.ts";
import {
  readAll,
  writeAll,
} from "https://deno.land/std@0.149.0/streams/mod.ts";
import { Buffer } from "https://deno.land/std@0.149.0/io/mod.ts";
import { tee } from "./tee.ts";

Deno.test("tee", async (t) => {
  const encoder = new TextEncoder();

  await t.step("returns tuple of two Deno.Reader & Deno.Closer", () => {
    const buffer = new Buffer();
    const [r1, r2] = tee(buffer);
    assert("read" in r1 && typeof r1.read === "function");
    assert("read" in r2 && typeof r2.read === "function");
  });

  await t.step(
    "each readers are independent copy of the original reader",
    async () => {
      const buffer = new Buffer();
      await writeAll(buffer, encoder.encode("Hello"));
      await writeAll(buffer, encoder.encode("World"));
      const [r1, r2] = tee(buffer);

      assertEquals(await readAll(r1), encoder.encode("HelloWorld"));
      assertEquals(await readAll(r2), encoder.encode("HelloWorld"));
    },
  );
});
