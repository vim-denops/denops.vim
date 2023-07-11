import { pipeThroughFrom } from "https://deno.land/x/streamtools@v0.5.0/mod.ts";
import { decode } from "https://deno.land/x/messagepack@v0.1.0/mod.ts";

export function traceReadableStream(
  stream: ReadableStream<Uint8Array>,
) {
  return stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        console.log("RECV", decode(chunk));
        controller.enqueue(chunk);
      },
    }),
  );
}

export function traceWritableStream(
  stream: WritableStream<Uint8Array>,
) {
  return pipeThroughFrom(
    stream,
    new TransformStream({
      transform(chunk, controller) {
        console.log("SENT", decode(chunk));
        controller.enqueue(chunk);
      },
    }),
  );
}
