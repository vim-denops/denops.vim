import {
  isObject,
  isString,
} from "https://deno.land/x/unknownutil@v2.1.1/mod.ts#^";

export function errorSerializer(err: unknown): unknown {
  if (err instanceof Error) {
    return JSON.stringify({
      name: err.name,
      message: err.message || String(err),
      stack: err.stack,
    });
  }
  return String(err);
}

export function errorDeserializer(err: unknown): unknown {
  if (isString(err)) {
    try {
      const obj = JSON.parse(err);
      if (isObject(obj) && isString(obj.message)) {
        return Object.assign(new Error(obj.message), obj);
      }
    } catch {
      // Do NOTHING
    }
  }
  return err;
}
