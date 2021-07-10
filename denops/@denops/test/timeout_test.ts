import { assertEquals, assertThrowsAsync, deferred } from "../deps_test.ts";
import { timeout, TimeoutError } from "./timeout.ts";

Deno.test("timeout() return fulfilled promise", async () => {
  const p = deferred();
  const t = setTimeout(() => p.resolve("Hello"), 100);
  const result = await timeout(p, 1000);
  assertEquals(result, "Hello");
  clearTimeout(t);
});
Deno.test("timeout() throws TimeoutError", async () => {
  const p = deferred();
  const t = setTimeout(() => p.resolve("Hello"), 1000);
  await assertThrowsAsync(async () => {
    await timeout(p, 100);
  }, TimeoutError);
  clearTimeout(t);
});
