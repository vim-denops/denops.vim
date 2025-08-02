import { isString } from "@core/unknownutil/is/string";
import {
  fromErrorObject,
  isErrorObject,
  toErrorObject,
  tryOr,
} from "@core/errorutil";

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
