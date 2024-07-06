import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertFalse,
  assertInstanceOf,
  assertMatch,
  assertNotStrictEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "jsr:@std/assert@0.225.1";
import {
  assertSpyCall,
  assertSpyCalls,
  resolvesNext,
  spy,
  stub,
} from "jsr:@std/testing@0.224.0/mock";
import type { Meta } from "jsr:@denops/core@6.0.6";
import { promiseState } from "jsr:@lambdalisue/async@2.1.1";
import { unimplemented } from "jsr:@lambdalisue/errorutil@1.0.0";
import type { Host } from "./denops.ts";
import { Service } from "./service.ts";
import { toFileUrl } from "jsr:@std/path@0.225.0/to-file-url";

const NOOP = () => {};

const scriptValid = resolve("dummy_valid_plugin.ts");
const scriptInvalid = resolve("dummy_invalid_plugin.ts");
const scriptValidDispose = resolve("dummy_valid_dispose_plugin.ts");
const scriptInvalidDispose = resolve("dummy_invalid_dispose_plugin.ts");
const scriptInvalidConstraint = resolve("dummy_invalid_constraint_plugin.ts");
const scriptInvalidConstraint2 = resolve("dummy_invalid_constraint_plugin2.ts");

Deno.test("Service", async (t) => {
  const meta: Meta = {
    mode: "debug",
    host: "vim",
    version: "dev",
    platform: "linux",
  };
  const host: Host = {
    redraw: () => unimplemented(),
    call: () => unimplemented(),
    batch: () => unimplemented(),
  };

  await t.step("new Service()", async (t) => {
    await t.step("creates an instance", () => {
      const actual = new Service(meta);

      assertInstanceOf(actual, Service);
    });
  });

  await t.step(".bind()", async (t) => {
    await t.step("binds the host", () => {
      const service = new Service(meta);

      service.bind(host);
    });
  });

  await t.step(".load()", async (t) => {
    await t.step("if no host is bound", async (t) => {
      const service = new Service(meta);

      await t.step("rejects", async () => {
        await assertRejects(
          () => service.load("dummy", scriptValid),
          Error,
          "No host is bound to the service",
        );
      });
    });

    await t.step("if the service is already closed", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      await service.close();
      using host_call = stub(host, "call");

      await t.step("rejects", async () => {
        await assertRejects(
          () => service.load("dummy", scriptValid),
          Error,
          "Service closed",
        );
      });

      await t.step("does not calls the host", () => {
        assertSpyCalls(host_call, 0);
      });
    });

    await t.step("if the plugin is valid", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.load("dummy", scriptValid);
      });

      await t.step("emits DenopsSystemPluginPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
            {},
          ],
        });
      });

      await t.step("calls the plugin entrypoint", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "echo 'Hello, Denops!'",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginPost", () => {
        assertSpyCall(host_call, 2, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPost:dummy",
            {},
          ],
        });
      });
    });

    await t.step("if the plugin entrypoint throws", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      using console_error = stub(console, "error");
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.load("dummy", scriptInvalid);
      });

      await t.step("outputs an error message", () => {
        assertSpyCall(console_error, 0, {
          args: [
            "Failed to load plugin 'dummy': Error: This is dummy error",
          ],
        });
      });

      await t.step("emits DenopsSystemPluginPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginFail", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginFail:dummy",
            {},
          ],
        });
      });
    });

    await t.step("if the plugin constraints could not find", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      using console_error = stub(console, "error");
      using console_warn = stub(console, "warn");
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.load("dummy", scriptInvalidConstraint);
      });

      await t.step("outputs an error message", () => {
        assertMatch(
          console_error.calls[0].args[0],
          /^Failed to load plugin 'dummy': TypeError: Could not find constraint in the list of versions:/,
        );
      });

      await t.step("outputs warning messages", () => {
        assertEquals(
          console_warn.calls.flatMap((c) => c.args),
          [
            "********************************************************************************",
            "Deno module cache issue is detected.",
            "Execute 'call denops#cache#update(#{reload: v:true})' and restart Vim/Neovim.",
            "See https://github.com/vim-denops/denops.vim/issues/358 for more detail.",
            "********************************************************************************",
          ],
        );
      });

      await t.step("emits DenopsSystemPluginPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginFail", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginFail:dummy",
            {},
          ],
        });
      });
    });

    await t.step(
      "if the plugin constraint versions could not find",
      async (t) => {
        const service = new Service(meta);
        service.bind(host);
        using console_error = stub(console, "error");
        using console_warn = stub(console, "warn");
        using host_call = stub(host, "call");

        await t.step("resolves", async () => {
          await service.load("dummy", scriptInvalidConstraint2);
        });

        await t.step("outputs an error message", () => {
          assertMatch(
            console_error.calls[0].args[0],
            /^Failed to load plugin 'dummy': TypeError: Could not find version of /,
          );
        });

        await t.step("outputs warning messages", () => {
          assertEquals(
            console_warn.calls.flatMap((c) => c.args),
            [
              "********************************************************************************",
              "Deno module cache issue is detected.",
              "Execute 'call denops#cache#update(#{reload: v:true})' and restart Vim/Neovim.",
              "See https://github.com/vim-denops/denops.vim/issues/358 for more detail.",
              "********************************************************************************",
            ],
          );
        });

        await t.step("emits DenopsSystemPluginPre", () => {
          assertSpyCall(host_call, 0, {
            args: [
              "denops#api#cmd",
              "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
              {},
            ],
          });
        });

        await t.step("emits DenopsSystemPluginFail", () => {
          assertSpyCall(host_call, 1, {
            args: [
              "denops#api#cmd",
              "doautocmd <nomodeline> User DenopsSystemPluginFail:dummy",
              {},
            ],
          });
        });
      },
    );

    await t.step("if the plugin is already loaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using console_log = stub(console, "log");
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.load("dummy", scriptValid);
      });

      await t.step("outputs a log message", () => {
        assertSpyCall(console_log, 0, {
          args: [
            "A denops plugin 'dummy' is already loaded. Skip",
          ],
        });
      });

      await t.step("does not calls the host", () => {
        assertSpyCalls(host_call, 0);
      });
    });

    await t.step("if the plugin is already unloaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
        await service.unload("dummy");
      }
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.load("dummy", scriptValid);
      });

      await t.step("emits DenopsSystemPluginPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
            {},
          ],
        });
      });

      await t.step("calls the plugin entrypoint", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "echo 'Hello, Denops!'",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginPost", () => {
        assertSpyCall(host_call, 2, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPost:dummy",
            {},
          ],
        });
      });
    });
  });

  await t.step(".unload()", async (t) => {
    await t.step("if the plugin returns void", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.unload("dummy");
      });

      await t.step("emits DenopsSystemPluginUnloadPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummy",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginUnloadPost", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummy",
            {},
          ],
        });
      });
    });

    await t.step("if the plugin returns AsyncDisposable", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValidDispose);
      }
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.unload("dummy");
      });

      await t.step("emits DenopsSystemPluginUnloadPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummy",
            {},
          ],
        });
      });

      await t.step("calls the plugin dispose method", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "echo 'Goodbye, Denops!'",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginUnloadPost", () => {
        assertSpyCall(host_call, 2, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummy",
            {},
          ],
        });
      });
    });

    await t.step("if the plugin dispose method throws", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptInvalidDispose);
      }
      using console_error = stub(console, "error");
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.unload("dummy");
      });

      await t.step("outputs an error message", () => {
        assertSpyCall(console_error, 0, {
          args: [
            "Failed to unload plugin 'dummy': Error: This is dummy error in async dispose",
          ],
        });
      });

      await t.step("emits DenopsSystemPluginUnloadPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummy",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginUnloadFail", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadFail:dummy",
            {},
          ],
        });
      });
    });

    await t.step("if the plugin is not yet loaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      using console_log = stub(console, "log");
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.unload("dummy");
      });

      await t.step("outputs a log message", () => {
        assertSpyCall(console_log, 0, {
          args: [
            "A denops plugin 'dummy' is not loaded yet. Skip",
          ],
        });
      });

      await t.step("does not calls the host", () => {
        assertSpyCalls(host_call, 0);
      });
    });

    await t.step("if the plugin is already unloaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
        await service.unload("dummy");
      }
      using console_log = stub(console, "log");
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.unload("dummy");
      });

      await t.step("outputs a log message", () => {
        assertSpyCall(console_log, 0, {
          args: [
            "A denops plugin 'dummy' is not loaded yet. Skip",
          ],
        });
      });

      await t.step("does not calls the host", () => {
        assertSpyCalls(host_call, 0);
      });
    });

    await t.step("if called before `load()` resolves", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      using host_call = stub(host, "call");

      const loadPromise = service.load("dummy", scriptValid);
      const unloadPromise = service.unload("dummy");

      await t.step("resolves", async () => {
        await unloadPromise;
      });

      await t.step("`load()` was resolved", async () => {
        assertEquals(await promiseState(loadPromise), "fulfilled");
      });

      await t.step("emits events in the correct order", () => {
        const events = host_call.calls
          .map((c) => c.args)
          .filter((args) => (args[1] as string)?.startsWith("doautocmd"));
        assertEquals(events, [
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
            {},
          ],
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPost:dummy",
            {},
          ],
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummy",
            {},
          ],
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummy",
            {},
          ],
        ]);
      });
    });

    await t.step("if called before `load()` resolves with error", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      using host_call = stub(host, "call");

      const loadPromise = service.load("dummy", scriptInvalid);
      const unloadPromise = service.unload("dummy");

      await t.step("resolves", async () => {
        await unloadPromise;
      });

      await t.step("`load()` was resolved", async () => {
        assertEquals(await promiseState(loadPromise), "fulfilled");
      });

      await t.step("emits events in the correct order", () => {
        const events = host_call.calls
          .map((c) => c.args)
          .filter((args) => (args[1] as string)?.startsWith("doautocmd"));
        assertEquals(events, [
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
            {},
          ],
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginFail:dummy",
            {},
          ],
        ]);
      });
    });

    await t.step("if `host.call()` rejects (channel closed)", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using console_error = stub(console, "error");
      using _host_call = stub(
        host,
        "call",
        () => Promise.reject(new Error("channel closed")),
      );

      await t.step("resolves", async () => {
        await service.unload("dummy");
      });

      await t.step("outputs error messages", () => {
        assertEquals(console_error.calls.map((c) => c.args), [
          [
            "Failed to emit DenopsSystemPluginUnloadPre:dummy: Error: channel closed",
          ],
          [
            "Failed to emit DenopsSystemPluginUnloadPost:dummy: Error: channel closed",
          ],
        ]);
      });
    });
  });

  await t.step(".reload()", async (t) => {
    await t.step("if the plugin is already loaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.reload("dummy");
      });

      await t.step("emits DenopsSystemPluginUnloadPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummy",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginUnloadPost", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummy",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginPre", () => {
        assertSpyCall(host_call, 2, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
            {},
          ],
        });
      });

      await t.step("calls the plugin entrypoint", () => {
        assertSpyCall(host_call, 3, {
          args: [
            "denops#api#cmd",
            "echo 'Hello, Denops!'",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginPost", () => {
        assertSpyCall(host_call, 4, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPost:dummy",
            {},
          ],
        });
      });
    });

    await t.step("if the plugin is not yet loaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      using console_log = stub(console, "log");
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.reload("dummy");
      });

      await t.step("outputs a log message", () => {
        assertSpyCall(console_log, 0, {
          args: [
            "A denops plugin 'dummy' is not loaded yet. Skip",
          ],
        });
      });

      await t.step("does not calls the host", () => {
        assertSpyCalls(host_call, 0);
      });
    });

    await t.step("if the plugin is already unloaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
        await service.unload("dummy");
      }
      using console_log = stub(console, "log");
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.reload("dummy");
      });

      await t.step("outputs a log message", () => {
        assertSpyCall(console_log, 0, {
          args: [
            "A denops plugin 'dummy' is not loaded yet. Skip",
          ],
        });
      });

      await t.step("does not calls the host", () => {
        assertSpyCalls(host_call, 0);
      });
    });

    await t.step("if the plugin file is changed", async (t) => {
      // Generate source script file.
      await using tempFile = await useTempFile({
        // NOTE: Temporary script files should be ignored from coverage.
        prefix: "test-denops-service-",
        suffix: "_test.ts",
      });
      const scriptRewrite = toFileUrl(tempFile.path).href;
      const sourceOriginal = await Deno.readTextFile(new URL(scriptValid));
      await Deno.writeTextFile(new URL(scriptRewrite), sourceOriginal);

      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptRewrite);
      }
      using host_call = stub(host, "call");

      // Change source script file.
      const sourceRewrited = sourceOriginal.replaceAll(
        "Hello, Denops!",
        "Source Changed!",
      );
      await Deno.writeTextFile(new URL(scriptRewrite), sourceRewrited);

      await t.step("resolves", async () => {
        await service.reload("dummy");
      });

      await t.step("emits DenopsSystemPluginUnloadPre", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummy",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginUnloadPost", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummy",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginPre", () => {
        assertSpyCall(host_call, 2, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
            {},
          ],
        });
      });

      await t.step("calls the plugin entrypoint", () => {
        assertSpyCall(host_call, 3, {
          args: [
            "denops#api#cmd",
            "echo 'Source Changed!'",
            {},
          ],
        });
      });

      await t.step("emits DenopsSystemPluginPost", () => {
        assertSpyCall(host_call, 4, {
          args: [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginPost:dummy",
            {},
          ],
        });
      });
    });
  });

  await t.step(".waitLoaded()", async (t) => {
    await t.step("pendings if the plugin is not yet loaded", async () => {
      const service = new Service(meta);
      service.bind(host);
      using _host_call = stub(host, "call");

      const actual = service.waitLoaded("dummy");

      assertEquals(await promiseState(actual), "pending");
    });

    await t.step("pendings if the plugin is already unloaded", async () => {
      const service = new Service(meta);
      service.bind(host);
      using _host_call = stub(host, "call");
      await service.load("dummy", scriptValid);
      await service.unload("dummy");

      const actual = service.waitLoaded("dummy");

      assertEquals(await promiseState(actual), "pending");
    });

    await t.step("resolves if the plugin is already loaded", async () => {
      const service = new Service(meta);
      service.bind(host);
      using _host_call = stub(host, "call");
      await service.load("dummy", scriptValid);

      const actual = service.waitLoaded("dummy");

      assertEquals(await promiseState(actual), "fulfilled");
    });

    await t.step("resolves when the plugin is loaded", async () => {
      const service = new Service(meta);
      service.bind(host);
      using _host_call = stub(host, "call");

      const actual = service.waitLoaded("dummy");
      await service.load("dummy", scriptValid);

      assertEquals(await promiseState(actual), "fulfilled");
    });

    await t.step(
      "resolves if it is called between `load()` and `unload()`",
      async () => {
        const service = new Service(meta);
        service.bind(host);
        using _host_call = stub(host, "call");

        const loadPromise = service.load("dummy", scriptValid);
        const actual = service.waitLoaded("dummy");
        const unloadPromise = service.unload("dummy");
        await Promise.all([loadPromise, unloadPromise]);

        assertEquals(await promiseState(actual), "fulfilled");
      },
    );

    await t.step("rejects if the service is already closed", async () => {
      const service = new Service(meta);
      service.bind(host);
      using _host_call = stub(host, "call");
      await service.close();

      const actual = service.waitLoaded("dummy");
      actual.catch(NOOP);

      assertEquals(await promiseState(actual), "rejected");
      await assertRejects(
        () => actual,
        Error,
        "Service closed",
      );
    });

    await t.step("rejects when the service is closed", async () => {
      const service = new Service(meta);
      service.bind(host);
      using _host_call = stub(host, "call");

      const actual = service.waitLoaded("dummy");
      await service.close();

      assertEquals(await promiseState(actual), "rejected");
      await assertRejects(
        () => actual,
        Error,
        "Service closed",
      );
    });
  });

  await t.step(".interrupt()", async (t) => {
    await t.step("sends signal to `interrupted` attribute", () => {
      const service = new Service(meta);
      const signal = service.interrupted;

      service.interrupt();

      assertThrows(() => signal.throwIfAborted());
    });

    await t.step("sends signal to `interrupted` attribute with reason", () => {
      const service = new Service(meta);
      const signal = service.interrupted;

      service.interrupt("test");

      assertThrows(() => signal.throwIfAborted(), "test");
    });
  });

  await t.step(".interrupted property", async (t) => {
    await t.step("does not aborted before .interrupt() is called", () => {
      const service = new Service(meta);

      assertFalse(service.interrupted.aborted);
    });

    await t.step("does not aborted after .interrupt() is called", () => {
      const service = new Service(meta);
      service.interrupt();

      assertFalse(service.interrupted.aborted);
    });

    await t.step("aborts when .interrupt() is called", () => {
      const service = new Service(meta);
      const signal = service.interrupted;

      service.interrupt();

      assert(signal.aborted);
    });

    await t.step("returns same instance if .interrupt() is not called", () => {
      const service = new Service(meta);

      const a = service.interrupted;
      const b = service.interrupted;

      assertStrictEquals(a, b);
    });

    await t.step("returns new instance after .interrupt() is called", () => {
      const service = new Service(meta);

      const a = service.interrupted;
      service.interrupt();
      const b = service.interrupted;

      assertNotStrictEquals(a, b);
    });
  });

  await t.step(".dispatch()", async (t) => {
    await t.step("if the plugin is already loaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.dispatch("dummy", "test", ["foo"]);
      });

      await t.step("calls the plugin API", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            `echo 'This is test call: ["foo"]'`,
            {},
          ],
        });
      });
    });

    await t.step("if the plugin is not yet loaded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      using host_call = stub(host, "call");

      await t.step("rejects with string", async () => {
        const err = await assertRejects(
          () => service.dispatch("dummy", "test", ["foo"]),
        );
        assert(typeof err === "string");
        assertMatch(err, /No plugin 'dummy' is loaded/);
      });

      await t.step("does not calls the host", () => {
        assertSpyCalls(host_call, 0);
      });
    });

    await t.step("if the plugin API call fails", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using host_call = stub(
        host,
        "call",
        resolvesNext([
          // The plugin API call
          new Error("invalid call"),
        ]),
      );

      await t.step("rejects with string", async () => {
        const err = await assertRejects(
          () => service.dispatch("dummy", "test", ["foo"]),
        );
        assert(typeof err === "string");
        assertMatch(err, /invalid call/);
      });

      await t.step("calls the plugin API", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            `echo 'This is test call: ["foo"]'`,
            {},
          ],
        });
      });
    });
  });

  await t.step(".dispatchAsync()", async (t) => {
    await t.step("if no host is bound", async (t) => {
      const service = new Service(meta);

      await t.step("rejects", async () => {
        await assertRejects(
          () =>
            service.dispatchAsync(
              "dummy",
              "test",
              ["foo"],
              "success",
              "failure",
            ),
          Error,
          "No host is bound to the service",
        );
      });
    });

    await t.step("if the plugin API calls succeeded", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.dispatchAsync(
          "dummy",
          "test",
          ["foo"],
          "success",
          "failure",
        );
      });

      await t.step("calls the plugin API", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            `echo 'This is test call: ["foo"]'`,
            {},
          ],
        });
      });

      await t.step("calls 'success' callback", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#callback#call",
            "success",
            undefined,
          ],
        });
      });
    });

    await t.step("if the plugin API calls failed", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using host_call = stub(
        host,
        "call",
        resolvesNext([
          // The plugin API call
          new Error("invalid call"),
          // 'success' callback call
          undefined,
        ]),
      );

      await t.step("resolves", async () => {
        await service.dispatchAsync(
          "dummy",
          "test",
          ["foo"],
          "success",
          "failure",
        );
      });

      await t.step("calls the plugin API", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            `echo 'This is test call: ["foo"]'`,
            {},
          ],
        });
      });

      await t.step("calls 'failure' callback", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#callback#call",
            "failure",
            host_call.calls[1].args[2],
          ],
        });
      });
    });

    await t.step("if 'success' callback calls failed", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using console_error = stub(console, "error");
      using host_call = stub(
        host,
        "call",
        resolvesNext([
          // The plugin API call
          undefined,
          // 'success' callback call
          new Error("invalid call"),
        ]),
      );

      await t.step("resolves", async () => {
        await service.dispatchAsync(
          "dummy",
          "test",
          ["foo"],
          "success",
          "failure",
        );
      });

      await t.step("calls the plugin API", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            `echo 'This is test call: ["foo"]'`,
            {},
          ],
        });
      });

      await t.step("calls 'success' callback", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#callback#call",
            "success",
            undefined,
          ],
        });
      });

      await t.step("outputs an error message", () => {
        assertSpyCall(console_error, 0, {
          args: [
            "Failed to call success callback 'success': Error: invalid call",
          ],
        });
      });
    });

    await t.step("if 'failure' callback calls failed", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
      }
      using console_error = stub(console, "error");
      using host_call = stub(
        host,
        "call",
        resolvesNext([
          // The plugin API call
          new Error("invalid call"),
          // 'failure' callback call
          new Error("invalid call"),
        ]),
      );

      await t.step("resolves", async () => {
        await service.dispatchAsync(
          "dummy",
          "test",
          ["foo"],
          "success",
          "failure",
        );
      });

      await t.step("calls the plugin API", () => {
        assertSpyCall(host_call, 0, {
          args: [
            "denops#api#cmd",
            `echo 'This is test call: ["foo"]'`,
            {},
          ],
        });
      });

      await t.step("calls 'failure' callback", () => {
        assertSpyCall(host_call, 1, {
          args: [
            "denops#callback#call",
            "failure",
            host_call.calls[1].args[2],
          ],
        });
      });

      await t.step("outputs an error message", () => {
        assertSpyCall(console_error, 0, {
          args: [
            "Failed to call failure callback 'failure': Error: invalid call",
          ],
        });
      });
    });
  });

  await t.step(".close()", async (t) => {
    await t.step("if the service is not yet closed", async (t) => {
      const service = new Service(meta);
      service.bind(host);
      {
        using _host_call = stub(host, "call");
        await service.load("dummy", scriptValid);
        await service.load("dummyDispose", scriptValidDispose);
      }
      using host_call = stub(host, "call");

      await t.step("resolves", async () => {
        await service.close();
      });

      await t.step("unloads loaded plugins", () => {
        assertArrayIncludes(host_call.calls.map((c) => c.args), [
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummy",
            {},
          ],
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyDispose",
            {},
          ],
          [
            "denops#api#cmd",
            "echo 'Goodbye, Denops!'",
            {},
          ],
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummy",
            {},
          ],
          [
            "denops#api#cmd",
            "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyDispose",
            {},
          ],
        ]);
      });
    });

    await t.step("if the service is already closed", async (t) => {
      const service = new Service(meta);
      using _host_call = stub(host, "call");
      service.bind(host);
      await service.close();

      await t.step("resolves", async () => {
        await service.close();
      });
    });
  });

  await t.step(".waitClosed()", async (t) => {
    await t.step("pendings if the service is not yet closed", async () => {
      using _host_call = stub(host, "call");
      const service = new Service(meta);
      service.bind(host);

      const actual = service.waitClosed();

      assertEquals(await promiseState(actual), "pending");
    });

    await t.step("resolves if the service is already closed", async () => {
      using _host_call = stub(host, "call");
      const service = new Service(meta);
      service.bind(host);
      service.close();

      const actual = service.waitClosed();

      assertEquals(await promiseState(actual), "fulfilled");
    });

    await t.step("resolves when the service is closed", async () => {
      using _host_call = stub(host, "call");
      const service = new Service(meta);
      service.bind(host);

      const actual = service.waitClosed();
      service.close();

      assertEquals(await promiseState(actual), "fulfilled");
    });
  });

  await t.step("[@@asyncDispose]()", async (t) => {
    const service = new Service(meta);
    using _host_call = stub(host, "call");
    service.bind(host);
    using service_close = spy(service, "close");

    await t.step("resolves", async () => {
      await service[Symbol.asyncDispose]();
    });

    await t.step("calls .close()", () => {
      assertSpyCalls(service_close, 1);
    });
  });
});

/** Resolve testdata script URL. */
function resolve(path: string): string {
  return new URL(`../../tests/denops/testdata/${path}`, import.meta.url).href;
}

async function useTempFile(options?: Deno.MakeTempOptions) {
  const path = await Deno.makeTempFile(options);
  return {
    path,
    async [Symbol.asyncDispose]() {
      await Deno.remove(path, { recursive: true });
    },
  };
}
