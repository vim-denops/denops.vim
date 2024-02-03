import { is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import {
  fromErrorObject,
  isErrorObject,
  toErrorObject,
  tryOr,
} from "https://deno.land/x/errorutil@v0.1.1/mod.ts";

export function errorSerializer(err: unknown): unknown {
  if (err instanceof Error) {
    return JSON.stringify(toErrorObject(err));
  } else if (typeof err === "string") {
    return err;
  }
  return JSON.stringify(err);
}

export function errorDeserializer(err: unknown): unknown {
  if (is.String(err)) {
    const obj = tryOr(() => JSON.parse(err), undefined);
    if (isErrorObject(obj)) {
      return fromErrorObject(obj);
    }
    return obj;
  }
  return err;
}
