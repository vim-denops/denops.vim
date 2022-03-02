import { copy } from "https://deno.land/std@0.127.0/streams/conversion.ts";
import {
  WorkerReader,
  WorkerWriter,
} from "https://deno.land/x/workerio@v1.4.3/mod.ts#^";

const worker = self as unknown as Worker;
const reader = new WorkerReader(worker);
const writer = new WorkerWriter(worker);

const addr = JSON.parse(Deno.env.get("DENOPS_TEST_ADDRESS") || "");
const conn = await Deno.connect(addr);

await Promise.race([
  copy(conn, writer).finally(() => conn.close()),
  copy(reader, conn),
]);
