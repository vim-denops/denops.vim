import {
  assertEquals,
  assertInstanceOf,
  assertMatch,
  assertNotMatch,
  assertRejects,
} from "jsr:@std/assert@1.0.1";
import { delay } from "jsr:@std/async@0.224.0/delay";
import { join } from "jsr:@std/path@0.225.0/join";
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
            resolve("shared_server_test_no_verbose.ts"),
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
          resolve("shared_server_test_verbose_true.ts"),
        ],
        stdout: "piped",
      }).spawn();
      const output = await proc.output();
      const stdout = new TextDecoder().decode(output.stdout);
      assertMatch(stdout, /Listen denops clients on/);
    });
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

/** Resolve testdata script path. */
function resolve(path: string): string {
  return join(import.meta.dirname!, `../testdata/${path}`);
}
