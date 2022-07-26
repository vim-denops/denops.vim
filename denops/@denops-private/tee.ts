import { Buffer } from "https://deno.land/std@0.149.0/io/mod.ts";
import { writeAll } from "https://deno.land/std@0.149.0/streams/mod.ts";

type Reader = Deno.Reader;
type ReadCloser = Reader & Deno.Closer;

type Status = {
  halfClosed: boolean;
};

class Tee<R extends Reader | ReadCloser> {
  #reader: R;
  #inner: Buffer;
  #outer: Buffer;
  #status: Status;

  constructor(reader: R, inner: Buffer, outer: Buffer, status: Status) {
    this.#reader = reader;
    this.#inner = inner;
    this.#outer = outer;
    this.#status = status;
  }

  async read(p: Uint8Array): Promise<number | null> {
    let n = await this.#inner.read(p);
    if (n) {
      return n;
    }
    n = await this.#reader.read(p);
    if (n && !this.#status.halfClosed) {
      await writeAll(this.#outer, p.subarray(0, n));
    }
    return n;
  }

  close(): void {
    if (this.#status.halfClosed) {
      if ("close" in this.#reader) {
        this.#reader.close();
      }
    }
    this.#status.halfClosed = true;
    this.#inner.reset();
  }
}

export function tee<R extends Reader | ReadCloser>(
  reader: R,
): [ReadCloser, ReadCloser] {
  const lhs = new Buffer();
  const rhs = new Buffer();
  const status = { halfClosed: false };
  return [new Tee(reader, lhs, rhs, status), new Tee(reader, rhs, lhs, status)];
}
