import { Buffer } from "https://deno.land/std@0.142.0/io/mod.ts";
import { writeAll } from "https://deno.land/std@0.142.0/streams/mod.ts";

type Reader = Deno.Reader;
type ReadCloser = Reader & Deno.Closer;

class Tee<R extends Reader | ReadCloser> {
  #reader: R;
  #inner: Buffer;
  #outer: Buffer;

  constructor(reader: R, inner: Buffer, outer: Buffer) {
    this.#reader = reader;
    this.#inner = inner;
    this.#outer = outer;
  }

  async read(p: Uint8Array): Promise<number | null> {
    let n = await this.#inner.read(p);
    if (n) {
      return n;
    }
    n = await this.#reader.read(p);
    if (n) {
      await writeAll(this.#outer, p.subarray(0, n));
    }
    return n;
  }

  close(): void {
    if ("close" in this.#reader) {
      this.#reader.close();
    }
  }
}

export function tee<R extends Reader | ReadCloser>(
  reader: R,
): [ReadCloser, ReadCloser] {
  const lhs = new Buffer();
  const rhs = new Buffer();
  return [new Tee(reader, lhs, rhs), new Tee(reader, rhs, lhs)];
}
