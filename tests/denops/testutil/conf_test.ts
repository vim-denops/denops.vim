import { assertEquals } from "jsr:@std/assert@1.0.1";
import { _internal } from "./conf.ts";

Deno.test({
  ignore: Deno.build.os === "windows",
  name: "_internal.removeTrailingSep (Linux/macOS)",
  fn: async (t) => {
    await t.step(
      "returns the path as-is if the path does not have a slash",
      () => {
        assertEquals(
          _internal.removeTrailingSep("."),
          ".",
        );
      },
    );
    await t.step(
      "returns the path as-is if the path does not have trailing slash",
      () => {
        assertEquals(
          _internal.removeTrailingSep("/path/to/denops"),
          "/path/to/denops",
        );
      },
    );
    await t.step("returns the path as-is if the path is for root", () => {
      assertEquals(
        _internal.removeTrailingSep("/"),
        "/",
      );
    });
    await t.step("returns the path without trailing slash", () => {
      assertEquals(
        _internal.removeTrailingSep("/path/to/denops/"),
        "/path/to/denops",
      );
    });
  },
});

Deno.test({
  ignore: Deno.build.os !== "windows",
  name: "_internal.removeTrailingSep (Windows)",
  fn: async (t) => {
    await t.step(
      "returns the path as-is if the path does not have a backslash",
      () => {
        assertEquals(
          _internal.removeTrailingSep("."),
          ".",
        );
      },
    );
    await t.step(
      "returns the path as-is if the path does not have trailing backslash",
      () => {
        assertEquals(
          _internal.removeTrailingSep("C:\\path\\to\\denops"),
          "C:\\path\\to\\denops",
        );
      },
    );
    await t.step("returns the path as-is if the path is for root", () => {
      assertEquals(
        _internal.removeTrailingSep("C:\\"),
        "C:\\",
      );
    });
    await t.step("returns the path without trailing backslash", () => {
      assertEquals(
        _internal.removeTrailingSep("C:\\path\\to\\denops\\"),
        "C:\\path\\to\\denops",
      );
    });
  },
});
