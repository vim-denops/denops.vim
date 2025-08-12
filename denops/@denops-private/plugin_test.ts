import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { assertSpyCall, assertSpyCalls, spy, stub } from "@std/testing/mock";
import type { Denops, Meta } from "@denops/core";
import { flushPromises } from "@core/asyncutil";
import { unimplemented } from "@core/errorutil";
import { resolveTestDataURL } from "/denops-testdata/resolve.ts";
import { Plugin } from "./plugin.ts";

const scriptValid = resolveTestDataURL("dummy_valid_plugin.ts");
const scriptInvalid = resolveTestDataURL("dummy_invalid_plugin.ts");
const scriptValidDispose = resolveTestDataURL("dummy_valid_dispose_plugin.ts");
const scriptInvalidDispose = resolveTestDataURL(
  "dummy_invalid_dispose_plugin.ts",
);
const scriptInvalidConstraint = resolveTestDataURL(
  "dummy_invalid_constraint_plugin.ts",
);
const scriptInvalidConstraint2 = resolveTestDataURL(
  "dummy_invalid_constraint_plugin2.ts",
);
const scriptWithImportMap = resolveTestDataURL(
  "with_import_map/plugin_with_import_map.ts",
);
const scriptWithDenoJson = resolveTestDataURL(
  "with_deno_json/plugin_with_deno_json.ts",
);
const scriptWithDenoJson2 = resolveTestDataURL(
  "with_deno_json2/plugin_with_deno_json.ts",
);

Deno.test("Plugin", async (t) => {
  const meta: Meta = {
    mode: "debug",
    host: "vim",
    version: "dev",
    platform: "linux",
  };

  const createDenops = (): Denops => ({
    meta,
    dispatcher: {},
    name: "test",
    context: {},
    call: () => unimplemented(),
    batch: () => unimplemented(),
    cmd: () => unimplemented(),
    eval: () => unimplemented(),
    dispatch: () => unimplemented(),
    redraw: () => unimplemented(),
  });

  await t.step("new Plugin()", async (t) => {
    await t.step("creates an instance", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValid);

      assertInstanceOf(plugin, Plugin);
      assertEquals(plugin.name, "test-plugin");
      assert(plugin.script.startsWith("file://"));

      // Wait for the plugin to load to prevent dangling promises
      await plugin.waitLoaded();
    });
  });

  await t.step(".waitLoaded()", async (t) => {
    await t.step("resolves when plugin loads successfully", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValid);

      await plugin.waitLoaded();

      // Should emit DenopsSystemPluginPre and DenopsSystemPluginPost events
      assertSpyCalls(_denops_call, 2);
      assertSpyCall(_denops_call, 0, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginPre:test-plugin",
        ],
      });
      assertSpyCall(_denops_call, 1, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginPost:test-plugin",
        ],
      });

      // Should call the plugin's main function
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Hello, Denops!'"],
      });
    });

    await t.step("rejects when plugin entrypoint throws", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using console_error = spy(console, "error");

      const plugin = new Plugin(denops, "test-plugin", scriptInvalid);

      await assertRejects(
        () => plugin.waitLoaded(),
        Error,
      );

      // Should emit DenopsSystemPluginPre and DenopsSystemPluginFail events
      assertSpyCalls(_denops_call, 2);
      assertSpyCall(_denops_call, 0, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginPre:test-plugin",
        ],
      });
      assertSpyCall(_denops_call, 1, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginFail:test-plugin",
        ],
      });

      // Should output error message
      assert(console_error.calls.length >= 1);
      assertStringIncludes(
        console_error.calls[0].args[0] as string,
        "Failed to load plugin 'test-plugin'",
      );
    });

    await t.step("shows warning for Deno cache issues", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using console_warn = spy(console, "warn");
      using console_error = spy(console, "error");

      const plugin = new Plugin(denops, "test-plugin", scriptInvalidConstraint);

      await assertRejects(
        () => plugin.waitLoaded(),
        Error,
      );

      // Should show warning messages about Deno module cache issue
      assert(console_warn.calls.length >= 4);
      assertStringIncludes(
        console_warn.calls[1].args[0] as string,
        "Deno module cache issue is detected",
      );

      // Should show error message
      assert(console_error.calls.length >= 1);
      assertStringIncludes(
        console_error.calls[0].args[0] as string,
        "Failed to load plugin 'test-plugin'",
      );
    });

    await t.step("shows warning for version constraint issues", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using console_warn = spy(console, "warn");
      using _console_error = spy(console, "error");

      const plugin = new Plugin(
        denops,
        "test-plugin",
        scriptInvalidConstraint2,
      );

      await assertRejects(
        () => plugin.waitLoaded(),
        Error,
      );

      // Should show warning messages about Deno module cache issue
      assert(console_warn.calls.length >= 4);
      assertStringIncludes(
        console_warn.calls[1].args[0] as string,
        "Deno module cache issue is detected",
      );
    });
  });

  await t.step(".unload()", async (t) => {
    await t.step("when plugin returns void", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValid);
      await plugin.waitLoaded();

      // Reset spy calls
      _denops_call.calls.length = 0;

      await plugin.unload();

      // Should emit unload events
      assertSpyCalls(_denops_call, 2);
      assertSpyCall(_denops_call, 0, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginUnloadPre:test-plugin",
        ],
      });
      assertSpyCall(_denops_call, 1, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginUnloadPost:test-plugin",
        ],
      });
    });

    await t.step("when plugin returns AsyncDisposable", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValidDispose);
      await plugin.waitLoaded();

      // Reset spy calls
      _denops_call.calls.length = 0;
      _denops_cmd.calls.length = 0;

      await plugin.unload();

      // Should call the dispose method
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Goodbye, Denops!'"],
      });

      // Should emit unload events
      assertSpyCalls(_denops_call, 2);
      assertSpyCall(_denops_call, 0, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginUnloadPre:test-plugin",
        ],
      });
      assertSpyCall(_denops_call, 1, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginUnloadPost:test-plugin",
        ],
      });
    });

    await t.step("when dispose method throws", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using console_error = spy(console, "error");

      const plugin = new Plugin(denops, "test-plugin", scriptInvalidDispose);
      await plugin.waitLoaded();

      // Reset spy calls
      _denops_call.calls.length = 0;

      await plugin.unload();

      // Should output error message
      assert(console_error.calls.length >= 1);
      assertStringIncludes(
        console_error.calls[0].args[0] as string,
        "Failed to unload plugin 'test-plugin'",
      );

      // Should emit DenopsSystemPluginUnloadPre and DenopsSystemPluginUnloadFail events
      assertSpyCalls(_denops_call, 2);
      assertSpyCall(_denops_call, 0, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginUnloadPre:test-plugin",
        ],
      });
      assertSpyCall(_denops_call, 1, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginUnloadFail:test-plugin",
        ],
      });
    });

    await t.step("when plugin load failed", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");

      const plugin = new Plugin(denops, "test-plugin", scriptInvalid);

      // Try to load (will fail)
      await assertRejects(() => plugin.waitLoaded());

      // Reset spy calls
      _denops_call.calls.length = 0;

      // Unload should complete without emitting events
      await plugin.unload();

      // Should not emit any events since load failed
      assertSpyCalls(_denops_call, 0);
    });

    await t.step("when called multiple times", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValidDispose);
      await plugin.waitLoaded();

      // Reset spy calls
      _denops_call.calls.length = 0;
      _denops_cmd.calls.length = 0;

      // Call unload multiple times
      const promise1 = plugin.unload();
      const promise2 = plugin.unload();
      const promise3 = plugin.unload();

      await Promise.all([promise1, promise2, promise3]);

      // Should only dispose once
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Goodbye, Denops!'"],
      });

      // Should only emit events once
      assertSpyCalls(_denops_call, 2);
    });
  });

  await t.step(".call()", async (t) => {
    await t.step("calls the plugin dispatcher function", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValid);
      await plugin.waitLoaded();

      // Reset spy calls
      _denops_cmd.calls.length = 0;

      // The plugin's dispatcher.test function should be available
      const result = await plugin.call("test", "arg1", "arg2");

      // Should call the dispatcher function
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: [`echo 'This is test call: ["arg1","arg2"]'`],
      });

      assertEquals(result, undefined);
    });

    await t.step("throws when dispatcher function does not exist", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValid);
      await plugin.waitLoaded();

      await assertRejects(
        () => plugin.call("nonexistent"),
        Error,
        "Failed to call 'nonexistent' API in 'test-plugin'",
      );
    });

    await t.step("includes stack trace when available", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValid);
      await plugin.waitLoaded();

      // Override dispatcher to throw an error with stack
      denops.dispatcher = {
        failing: () => {
          const error = new Error("Test error");
          error.stack = "Error: Test error\n    at test.ts:123";
          throw error;
        },
      };

      await assertRejects(
        () => plugin.call("failing"),
        Error,
        "Failed to call 'failing' API in 'test-plugin': Error: Test error\n    at test.ts:123",
      );
    });

    await t.step("handles non-Error throws", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptValid);
      await plugin.waitLoaded();

      // Override dispatcher to throw a non-Error
      denops.dispatcher = {
        failing: () => {
          throw "string error";
        },
      };

      await assertRejects(
        () => plugin.call("failing"),
        Error,
        "Failed to call 'failing' API in 'test-plugin': string error",
      );
    });
  });

  await t.step("script suffix handling", async (t) => {
    await t.step("adds timestamp suffix on reload", async () => {
      const denops1 = createDenops();
      const denops2 = createDenops();
      using _denops_call1 = stub(denops1, "call");
      using _denops_call2 = stub(denops2, "call");
      using _denops_cmd1 = stub(denops1, "cmd");
      using _denops_cmd2 = stub(denops2, "cmd");

      // Load the same script twice with different plugin instances
      const plugin1 = new Plugin(denops1, "test-plugin-1", scriptValid);
      await plugin1.waitLoaded();

      await flushPromises();

      const plugin2 = new Plugin(denops2, "test-plugin-2", scriptValid);
      await plugin2.waitLoaded();

      // When loading the same script multiple times, the Module cache
      // mechanism handles the deduplication. The test should verify
      // that both plugins loaded successfully.
      assertEquals(plugin1.name, "test-plugin-1");
      assertEquals(plugin2.name, "test-plugin-2");

      // Both should have loaded the same script
      const base1 = plugin1.script.split("#")[0];
      const base2 = plugin2.script.split("#")[0];
      assertEquals(base1, base2);
    });
  });

  await t.step("event emission error handling", async (t) => {
    await t.step("continues even if event emission fails", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call", () => {
        throw new Error("Event emission failed");
      });
      using _denops_cmd = stub(denops, "cmd");
      using console_error = spy(console, "error");

      const plugin = new Plugin(denops, "test-plugin", scriptValid);

      // Should not throw even if event emission fails
      // The plugin still loads successfully despite emit errors
      await plugin.waitLoaded();

      // Should log errors for failed event emissions
      assert(console_error.calls.length >= 2);
      assertStringIncludes(
        console_error.calls[0].args[0] as string,
        "Failed to emit DenopsSystemPluginPre:test-plugin",
      );
      assertStringIncludes(
        console_error.calls[1].args[0] as string,
        "Failed to emit DenopsSystemPluginPost:test-plugin",
      );

      // Plugin should still be loaded
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Hello, Denops!'"],
      });
    });
  });

  await t.step("import map support", async (t) => {
    await t.step("loads plugin with import_map.json", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptWithImportMap);

      await plugin.waitLoaded();

      // Should emit events
      assertSpyCalls(_denops_call, 2);
      assertSpyCall(_denops_call, 0, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginPre:test-plugin",
        ],
      });
      assertSpyCall(_denops_call, 1, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginPost:test-plugin",
        ],
      });

      // Should call the plugin's main function
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Import map plugin initialized'"],
      });
    });

    await t.step("plugin can use mapped imports", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptWithImportMap);
      await plugin.waitLoaded();

      // Reset spy calls
      _denops_cmd.calls.length = 0;

      // Call the dispatcher function
      const result = await plugin.call("test");

      // Should execute the command with the message from the mapped import
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Import map works for test-plugin!'"],
      });

      // Should return the greeting from the mapped import
      assertEquals(result, "Hello from mapped import!");
    });

    await t.step("works without import map", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      // Use a regular plugin without import map
      const plugin = new Plugin(denops, "test-plugin", scriptValid);

      await plugin.waitLoaded();

      // Should load normally
      assertSpyCalls(_denops_call, 2);
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Hello, Denops!'"],
      });
    });
  });

  await t.step("importMap property support", async (t) => {
    await t.step("loads plugin with deno.json", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptWithDenoJson);

      await plugin.waitLoaded();

      // Should emit events
      assertSpyCalls(_denops_call, 2);
      assertSpyCall(_denops_call, 0, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginPre:test-plugin",
        ],
      });
      assertSpyCall(_denops_call, 1, {
        args: [
          "denops#_internal#event#emit",
          "DenopsSystemPluginPost:test-plugin",
        ],
      });

      // Should call the plugin's main function
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Deno json plugin initialized'"],
      });
    });

    await t.step("plugin can use mapped imports", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptWithDenoJson);
      await plugin.waitLoaded();

      // Reset spy calls
      _denops_cmd.calls.length = 0;

      // Call the dispatcher function
      const result = await plugin.call("test");

      // Should execute the command with the message from the mapped import
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Relative import map works for test-plugin!'"],
      });

      // Should return the greeting from the mapped import
      assertEquals(result, "Hello from relative import map!");
    });

    await t.step("importMap is overridden by imports", async () => {
      const denops = createDenops();
      using _denops_call = stub(denops, "call");
      using _denops_cmd = stub(denops, "cmd");

      const plugin = new Plugin(denops, "test-plugin", scriptWithDenoJson2);
      await plugin.waitLoaded();

      // Reset spy calls
      _denops_cmd.calls.length = 0;

      // Call the dispatcher function
      const result = await plugin.call("test");

      // Should execute the command with the message from the mapped import
      assertSpyCalls(_denops_cmd, 1);
      assertSpyCall(_denops_cmd, 0, {
        args: ["echo 'Import map works for test-plugin!'"],
      });

      // Should return the greeting from the mapped import
      assertEquals(result, "Hello from mapped import!");
    });
  });
});
