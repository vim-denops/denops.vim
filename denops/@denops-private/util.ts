import type { Meta } from "@denops/core";
import type { Predicate } from "@core/unknownutil/type";
import { isLiteralOneOf } from "@core/unknownutil/is/literal-one-of";
import { isObjectOf } from "@core/unknownutil/is/object-of";
import { isString } from "@core/unknownutil/is/string";

export const isMeta: Predicate<Meta> = isObjectOf({
  mode: isLiteralOneOf(["release", "debug", "test"] as const),
  host: isLiteralOneOf(["vim", "nvim"] as const),
  version: isString,
  platform: isLiteralOneOf(["windows", "mac", "linux"] as const),
});
