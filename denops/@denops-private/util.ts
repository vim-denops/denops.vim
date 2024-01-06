import type { Meta } from "https://deno.land/x/denops_core@v5.0.0/mod.ts";
import { is, Predicate } from "https://deno.land/x/unknownutil@v3.13.0/mod.ts";

export const isMeta: Predicate<Meta> = is.ObjectOf({
  mode: is.LiteralOneOf(["release", "debug", "test"] as const),
  host: is.LiteralOneOf(["vim", "nvim"] as const),
  version: is.String,
  platform: is.LiteralOneOf(["windows", "mac", "linux"] as const),
});
