const textDecoder = new TextDecoder();

export class TraceReader implements Deno.Reader, Deno.Closer {
  #reader: Deno.Reader & Deno.Closer;

  constructor(reader: Deno.Reader & Deno.Closer) {
    this.#reader = reader;
  }

  close(): void {
    this.#reader.close();
  }

  async read(p: Uint8Array): Promise<number | null> {
    const n = await this.#reader.read(p);
    if (n) {
      const value = p.subarray(0, n);
      try {
        console.log("r:", textDecoder.decode(value));
      } catch {
        console.log("r:", value);
      }
    }
    return n;
  }
}

export class TraceWriter implements Deno.Writer {
  #writer: Deno.Writer;

  constructor(writer: Deno.Writer) {
    this.#writer = writer;
  }

  async write(p: Uint8Array): Promise<number> {
    const n = await this.#writer.write(p);
    const value = p.subarray(0, n);
    try {
      console.log("w:", textDecoder.decode(value));
    } catch {
      console.log("w:", value);
    }
    return n;
  }
}
