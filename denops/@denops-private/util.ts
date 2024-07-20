import type { Meta } from "jsr:@denops/core@7.0.0";
import { is, type Predicate } from "jsr:@core/unknownutil@3.18.1";

export const isMeta: Predicate<Meta> = is.ObjectOf({
  mode: is.LiteralOneOf(["release", "debug", "test"] as const),
  host: is.LiteralOneOf(["vim", "nvim"] as const),
  version: is.String,
  platform: is.LiteralOneOf(["windows", "mac", "linux"] as const),
});
