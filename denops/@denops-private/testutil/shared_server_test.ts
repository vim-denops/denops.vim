import {
  assertInstanceOf,
  assertMatch,
  assertRejects,
} from "jsr:@std/assert@0.225.2";
import { delay } from "jsr:@std/async@^0.224.0/delay";
import { stub } from "jsr:@std/testing@0.224.0/mock";
import { useSharedServer } from "./shared_server.ts";

Deno.test("useSharedServer()", async (t) => {
  await t.step("returns `result.addr`", async () => {
    await using server = await useSharedServer();
    assertMatch(server.addr, /^127\.0\.0\.1:\d+$/);
  });

  await t.step("returns `result.stdout`", async () => {
    await using server = await useSharedServer();
    assertInstanceOf(server.stdout, ReadableStream);
    const outputs: string[] = [];
    server.stdout.pipeTo(
      new WritableStream({
        write: (line) => void outputs.push(line),
      }),
    ).catch(() => {});
    await delay(100);
    assertMatch(outputs.join("\n"), /Listen denops clients on/);
  });

  await t.step("calls console.log() if `verbose` is true", async () => {
    using console_log = stub(console, "log");
    await using _server = await useSharedServer({ verbose: true });
    await delay(100);
    const outputs = console_log.calls.flatMap((call) => call.args).join("\n");
    assertMatch(outputs, /Listen denops clients on/);
  });

  await t.step("closes child process when rejectes", async () => {
    await assertRejects(
      async () => {
        await useSharedServer({ timeout: 0 });
      },
      Error,
      "Deadline",
    );
  });
});
