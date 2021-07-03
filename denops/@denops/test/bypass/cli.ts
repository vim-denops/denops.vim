import {
  WorkerReader,
  WorkerWriter,
} from "../../vendor/https/deno.land/x/workerio/mod.ts";

// deno-lint-ignore no-explicit-any
const worker = self as any;
const reader = new WorkerReader(worker);
const writer = new WorkerWriter(worker);

const addr = JSON.parse(Deno.env.get("DENOPS_TEST_ADDRESS") || "");
const conn = await Deno.connect(addr);

await Promise.race([
  Deno.copy(conn, writer).finally(() => conn.close()),
  Deno.copy(reader, conn),
]);
