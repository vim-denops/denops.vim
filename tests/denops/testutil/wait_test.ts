import { assertEquals, assertRejects } from "@std/assert";
import {
  assertSpyCalls,
  resolvesNext,
  returnsNext,
  spy,
} from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { wait } from "./wait.ts";

Deno.test("wait()", async (t) => {
  await t.step("calls `fn` periodically", async () => {
    using time = new FakeTime();
    const fn = spy(returnsNext([0, 0, 1]));
    const p = wait(fn);
    assertSpyCalls(fn, 1);
    await time.tickAsync(50);
    assertSpyCalls(fn, 2);
    await time.tickAsync(50);
    assertSpyCalls(fn, 3);
    assertEquals(await p, 1);
  });

  await t.step("calls `fn` specified `interval`", async () => {
    using time = new FakeTime();
    const fn = spy(returnsNext([0, 0, 1]));
    const p = wait(fn, { interval: 100 });
    assertSpyCalls(fn, 1);
    await time.tickAsync(100);
    assertSpyCalls(fn, 2);
    await time.tickAsync(100);
    assertSpyCalls(fn, 3);
    assertEquals(await p, 1);
  });

  await t.step("resolves with `fn` return value", async () => {
    const fn = spy(returnsNext([42]));
    const actual = await wait(fn);
    assertEquals(actual, 42);
  });

  await t.step("resolves with only truthy `fn` return value", async () => {
    const fn = spy(returnsNext([0, false, null, undefined, "", "foo"]));
    const actualPromise = wait(fn, { interval: 0 });
    assertEquals(await actualPromise, "foo");
  });

  await t.step("rejects when `fn` throws", async () => {
    const fn = spy(returnsNext([new Error("fn-throws")]));
    await assertRejects(() => wait(fn), Error, "fn-throws");
  });

  await t.step("rejects when `fn` rejects", async () => {
    const fn = spy(resolvesNext([new Error("fn-throws")]));
    await assertRejects(() => wait(fn), Error, "fn-throws");
  });

  await t.step("rejects when `timeout`", async () => {
    using time = new FakeTime();
    const fn = spy(returnsNext([0, 0]));
    const p = wait(fn, { timeout: 150, interval: 100 });
    await time.tickAsync(150);
    await assertRejects(() => p, Error, "Timeout in 150 millisec.");
    assertSpyCalls(fn, 2);
  });

  await t.step("rejects with `message`", async () => {
    using time = new FakeTime();
    const fn = spy(returnsNext([0, 0]));
    const p = wait(fn, { message: "foo bar", timeout: 150, interval: 100 });
    await time.tickAsync(150);
    await assertRejects(() => p, Error, "Timeout in 150 millisec: foo bar");
    assertSpyCalls(fn, 2);
  });
});
