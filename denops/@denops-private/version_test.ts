import { assert, assertEquals } from "jsr:@std/assert@1.0.1";
import { resolvesNext, stub } from "jsr:@std/testing@0.224.0/mock";
import type { SemVer } from "jsr:@std/semver@0.224.0/types";
import { is, type Predicate } from "jsr:@core/unknownutil@3.18.1";
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
          stdout: new TextEncoder().encode("invalid value"),
          stderr: new Uint8Array(),
        }]),
      );
      const actual = await getVersionOr({ foo: "fallback value" });
      assertEquals(actual, { foo: "fallback value" });
    });
  });
});

const isSemVer = is.ObjectOf({
  major: is.Number,
  minor: is.Number,
  patch: is.Number,
  prerelease: is.ArrayOf(is.UnionOf([is.String, is.Number])),
  build: is.ArrayOf(is.String),
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
