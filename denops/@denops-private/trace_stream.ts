import { pipeThroughFrom } from "https://deno.land/x/streamtools@v0.5.0/mod.ts";
import { decode } from "https://deno.land/x/messagepack@v1.0.0/mod.ts";
import {
  isMessage,
  Message,
} from "https://deno.land/x/messagepack_rpc@v2.0.3/mod.ts";

export function traceReadableStream(
  stream: ReadableStream<Uint8Array>,
  { prefix, suffix }: { prefix?: string; suffix?: string } = {},
) {
  return stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const data = decode(chunk);
        if (isMessage(data)) {
          const m = stringifyMessage(data);
          console.log(`${prefix ?? ""}${m}${suffix ?? ""}`);
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

export function traceWritableStream(
  stream: WritableStream<Uint8Array>,
  { prefix, suffix }: { prefix?: string; suffix?: string } = {},
) {
  return pipeThroughFrom(
    stream,
    new TransformStream({
      transform(chunk, controller) {
        const data = decode(chunk);
        if (isMessage(data)) {
          const m = stringifyMessage(data);
          console.log(`${prefix ?? ""}${m}${suffix ?? ""}`);
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

function stringifyMessage(m: Message): string {
  switch (m[0]) {
    case 0: {
      const [_, msgid, method, params] = m;
      const paramsStr = params.map((p) => JSON.stringify(p)).join(", ");
      return `[${msgid}] request: ${method}(${paramsStr})`;
    }
    case 1: {
      const [_, msgid, error, result] = m;
      if (error) {
        return `[${msgid}] response: ERROR: ${error}`;
      } else {
        return `[${msgid}] response: ${result}`;
      }
    }
    case 2: {
      const [_, method, params] = m;
      const paramsStr = params.map((p) => JSON.stringify(p)).join(", ");
      return `notify: ${method}(${paramsStr})`;
    }
  }
}
