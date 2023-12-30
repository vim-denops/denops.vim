import type { Meta } from "../@denops/mod.ts";
import { is, Predicate } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";

export const isMeta: Predicate<Meta> = is.ObjectOf({
  mode: is.LiteralOneOf(["release", "debug", "test"] as const),
  host: is.LiteralOneOf(["vim", "nvim"] as const),
  version: is.String,
  platform: is.LiteralOneOf(["windows", "mac", "linux"] as const),
});
