import type { Meta } from "jsr:@denops/core@^7.0.0";
import type { Predicate } from "jsr:@core/unknownutil@^4.0.0/type";
import { isLiteralOneOf } from "jsr:@core/unknownutil@^4.0.0/is/literal-one-of";
import { isObjectOf } from "jsr:@core/unknownutil@^4.0.0/is/object-of";
import { isString } from "jsr:@core/unknownutil@^4.0.0/is/string";

export const isMeta: Predicate<Meta> = isObjectOf({
  mode: isLiteralOneOf(["release", "debug", "test"] as const),
  host: isLiteralOneOf(["vim", "nvim"] as const),
  version: isString,
  platform: isLiteralOneOf(["windows", "mac", "linux"] as const),
});
