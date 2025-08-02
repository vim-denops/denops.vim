import {
  assertEquals,
  assertInstanceOf,
  assertMatch,
  assertNotMatch,
  assertRejects,
} from "@std/assert";
import { delay } from "@std/async/delay";
import { retry } from "@std/async/retry";
import { resolveTestDataPath } from "/denops-testdata/resolve.ts";
import { useSharedServer } from "./shared_server.ts";

Deno.test("useSharedServer()", async (t) => {
  const HAS_DENOPS_TEST_VERBOSE = Deno.env.has("DENOPS_TEST_VERBOSE");

  await t.step({
    name: "if `verbose` is not specified",
    ignore: HAS_DENOPS_TEST_VERBOSE,
    fn: async (t) => {
      await t.step("returns `result.addr`", async (t) => {
        await using server = await useSharedServer();
        const { addr } = server;

        await t.step("`addr.host` is string", () => {
          assertEquals(addr.host, "127.0.0.1");
        });
        await t.step("`addr.port` is number", () => {
          assertEquals(typeof addr.port, "number");
        });
        await t.step("`addr.toString()` returns the address", () => {
          assertMatch(addr.toString(), /^127\.0\.0\.1:\d+$/);
        });
      });

      await t.step("returns `result.stdout`", async () => {
        await using server = await useSharedServer();
        assertInstanceOf(server.stdout, ReadableStream);
        const outputs: string[] = [];
        server.stdout.pipeTo(
          new WritableStream({ write: (line) => void outputs.push(line) }),
        ).catch(() => {});
        await delay(100);
        assertMatch(outputs.join("\n"), /Listen denops clients on/);
      });

      await t.step("does not output stdout", async () => {
        const proc = new Deno.Command(Deno.execPath(), {
          args: [
            "run",
            "--allow-env",
            "--allow-read",
            "--allow-run",
            resolveTestDataPath("shared_server_test_no_verbose.ts"),
          ],
          stdout: "piped",
        }).spawn();
        const output = await proc.output();
        const stdout = new TextDecoder().decode(output.stdout);
        assertNotMatch(stdout, /Listen denops clients on/);
      });
    },
  });

  await t.step("if `verbose` is true", async (t) => {
    await t.step("returns `result.addr`", async (t) => {
      await using server = await useSharedServer({ verbose: true });
      const { addr } = server;

      await t.step("`addr.host` is string", () => {
        assertEquals(addr.host, "127.0.0.1");
      });
      await t.step("`addr.port` is number", () => {
        assertEquals(typeof addr.port, "number");
      });
      await t.step("`addr.toString()` returns the address", () => {
        assertMatch(addr.toString(), /^127\.0\.0\.1:\d+$/);
      });
    });

    await t.step("returns `result.stdout`", async () => {
      await using server = await useSharedServer({ verbose: true });
      assertInstanceOf(server.stdout, ReadableStream);
      const outputs: string[] = [];
      server.stdout.pipeTo(
        new WritableStream({ write: (line) => void outputs.push(line) }),
      ).catch(() => {});
      await delay(100);
      assertMatch(outputs.join("\n"), /Listen denops clients on/);
    });

    await t.step("outputs stdout", async () => {
      const proc = new Deno.Command(Deno.execPath(), {
        args: [
          "run",
          "--allow-env",
          "--allow-read",
          "--allow-run",
          resolveTestDataPath("shared_server_test_verbose_true.ts"),
        ],
        stdout: "piped",
      }).spawn();
      const output = await proc.output();
      const stdout = new TextDecoder().decode(output.stdout);
      assertMatch(stdout, /Listen denops clients on/);
    });
  });

  await t.step("rejects if the server startup times out (flaky)", async () => {
    await retry(async () => {
      await assertRejects(
        async () => {
          await using _server = await useSharedServer({ timeout: 0 });
        },
        Error,
        "Signal timed out",
      );
    });
  });
});
