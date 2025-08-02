import { assert, assertEquals } from "@std/assert";
import { resolvesNext, stub } from "@std/testing/mock";
import type { SemVer } from "@std/semver/types";
import type { Predicate } from "@core/unknownutil/type";
import { isArrayOf } from "@core/unknownutil/is/array-of";
import { isNumber } from "@core/unknownutil/is/number";
import { isObjectOf } from "@core/unknownutil/is/object-of";
import { isString } from "@core/unknownutil/is/string";
import { isUnionOf } from "@core/unknownutil/is/union-of";
import { getVersionOr } from "./version.ts";

Deno.test("getVersionOr()", async (t) => {
  const HAS_TAG = (await isInsideWorkTree()) && (await isWorkTreeHasTags());

  await t.step({
    name: "resolves a SemVer from git tags",
    ignore: !HAS_TAG,
    fn: async () => {
      const actual = await getVersionOr({});
      assert(isSemVer(actual));
    },
  });

  await t.step("if git command fails", async (t) => {
    await t.step("resolves with `fallback`", async () => {
      using _deno_command_output = stub(
        Deno.Command.prototype,
        "output",
        resolvesNext([{
          success: false,
          code: 1,
          signal: null,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
        }]),
      );
      const actual = await getVersionOr({ foo: "fallback value" });
      assertEquals(actual, { foo: "fallback value" });
    });
  });

  await t.step("if git command outputs invalid value", async (t) => {
    await t.step("resolves with `fallback`", async () => {
      using _deno_command_output = stub(
        Deno.Command.prototype,
        "output",
        resolvesNext([{
          success: true,
          code: 0,
          signal: null,
          stdout: new Uint8Array(new TextEncoder().encode("invalid value")),
          stderr: new Uint8Array(),
        }]),
      );
      const actual = await getVersionOr({ foo: "fallback value" });
      assertEquals(actual, { foo: "fallback value" });
    });
  });
});

const isSemVer = isObjectOf({
  major: isNumber,
  minor: isNumber,
  patch: isNumber,
  prerelease: isArrayOf(isUnionOf([isString, isNumber])),
  build: isArrayOf(isString),
}) satisfies Predicate<SemVer>;

async function isInsideWorkTree(): Promise<boolean> {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--is-inside-work-tree"],
    stdout: "piped",
  });
  try {
    const { stdout } = await cmd.output();
    return /^true/.test(new TextDecoder().decode(stdout));
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function isWorkTreeHasTags(): Promise<boolean> {
  const cmd = new Deno.Command("git", {
    args: ["describe", "--tags", "--always"],
    stdout: "piped",
  });
  try {
    const { stdout } = await cmd.output();
    return /-/.test(new TextDecoder().decode(stdout));
  } catch (e) {
    console.error(e);
    return false;
  }
}
