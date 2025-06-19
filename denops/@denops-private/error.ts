import { isString } from "jsr:@core/unknownutil@^4.0.0/is/string";
import {
  fromErrorObject,
  isErrorObject,
  toErrorObject,
  tryOr,
} from "jsr:@core/errorutil@^1.2.1";

export function errorSerializer(err: unknown): unknown {
  if (err instanceof Error) {
    return JSON.stringify(toErrorObject(err));
  } else if (typeof err === "string") {
    return err;
  }
  return JSON.stringify(err);
}

export function errorDeserializer(err: unknown): unknown {
  if (isString(err)) {
    const obj = tryOr(() => JSON.parse(err), undefined);
    if (isErrorObject(obj)) {
      return fromErrorObject(obj);
    }
    return obj;
  }
  return err;
}
