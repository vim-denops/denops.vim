import { is } from "https://deno.land/x/unknownutil@v3.11.0/mod.ts";

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
  if (is.String(err)) {
    try {
      const obj = JSON.parse(err);
      if (is.Record(obj) && is.String(obj.message)) {
        return Object.assign(new Error(obj.message), obj);
      }
    } catch {
      // Do NOTHING
    }
  }
  return err;
}
