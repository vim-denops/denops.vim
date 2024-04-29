import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertMatch,
  assertObjectMatch,
  assertRejects,
  unimplemented,
} from "jsr:@std/assert@0.225.1";
import {
  assertSpyCallArgs,
  assertSpyCalls,
  stub,
} from "jsr:@std/testing@0.224.0/mock";
import { toFileUrl } from "jsr:@std/path@0.224.0";
import { promiseState } from "jsr:@lambdalisue/async@2.1.1";
import type { Meta } from "jsr:@denops/core@6.1.0";
import type { Host } from "./denops.ts";
import { Service } from "./service.ts";

const scriptValid =
  new URL("./testdata/dummy_valid_plugin.ts", import.meta.url).href;
const scriptValidDispose =
  new URL("./testdata/dummy_valid_dispose_plugin.ts", import.meta.url).href;
const scriptInvalidMain =
  new URL("./testdata/dummy_invalid_main_plugin.ts", import.meta.url).href;
const scriptInvalidDispose =
  new URL("./testdata/dummy_invalid_dispose_plugin.ts", import.meta.url).href;
const scriptRewriteBase =
  new URL("./testdata/dummy_rewrite_base_plugin.ts", import.meta.url).href;

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
  const service = new Service(meta);

  await using tempFile = {
    path: await Deno
      .makeTempFile({
        prefix: "temp-service_test-",
        suffix: "plugin-to-rewrite.ts",
      })
      .catch((e) => {
        console.error(e);
      }),
    async [Symbol.asyncDispose]() {
      if (this.path) {
        await Deno.remove(this.path);
      }
    },
  } as { path?: string } & AsyncDisposable;

  await t.step("load() rejects an error when no host is bound", async () => {
    await assertRejects(
      () => service.load("dummyValid", scriptValid),
      Error,
      "No host is bound to the service",
    );
  });

  await t.step(
    "dispatchAsync() rejects when no host is bound",
    async () => {
      await assertRejects(
        () =>
          service.dispatchAsync(
            "dummyValid",
            "test",
            ["foo"],
            "success",
            "failure",
          ),
        Error,
        "No host is bound to the service",
      );
    },
  );

  service.bind(host);

  const waitLoadedSuccess = service.waitLoaded("dummyValid");

  await t.step(
    "the result promise of waitLoaded() is 'pending' when the plugin is not loaded yet",
    async () => {
      assertEquals(await promiseState(waitLoadedSuccess), "pending");
    },
  );

  await t.step("load() loads plugin and emits autocmd events", async () => {
    using host_call = stub(host, "call");
    await service.load("dummyValid", scriptValid);
    assertSpyCalls(host_call, 3);
    assertSpyCallArgs(host_call, 0, [
      "denops#api#cmd",
      "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyValid",
      {},
    ]);
    assertSpyCallArgs(host_call, 1, [
      "denops#api#cmd",
      "echo 'Hello, Denops!'",
      {},
    ]);
    assertSpyCallArgs(host_call, 2, [
      "denops#api#cmd",
      "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyValid",
      {},
    ]);
  });

  await t.step(
    "the result promise of waitLoaded() become 'fulfilled' when the plugin is loaded",
    async () => {
      assertEquals(await promiseState(waitLoadedSuccess), "fulfilled");
    },
  );

  const waitLoadedFail = service.waitLoaded("dummyInvalidMain");

  await t.step(
    "load() loads plugin and emits autocmd events (failure)",
    async () => {
      using host_call = stub(host, "call");
      using console_error = stub(console, "error");
      await service.load("dummyInvalidMain", scriptInvalidMain);
      assertSpyCalls(host_call, 3);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyInvalidMain",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "echo 'I will throw an Error!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginFail:dummyInvalidMain",
        {},
      ]);
      assertSpyCalls(console_error, 1);
      assertSpyCallArgs(console_error, 0, [
        "Failed to load plugin 'dummyInvalidMain': Error: This is dummy error",
      ]);
    },
  );

  await t.step(
    "the result promise of waitLoaded() become 'rejected' when the plugin is load failed",
    async () => {
      assertEquals(await promiseState(waitLoadedFail), "rejected");
      const actual = await assertRejects(() => waitLoadedFail);
      assertEquals(actual, "DenopsPluginFail:dummyInvalidMain");
    },
  );

  await t.step(
    "load() does nothing when the plugin is already loaded",
    async () => {
      using host_call = stub(host, "call");
      using console_log = stub(console, "log");
      await service.load("dummyValid", scriptValid);
      assertSpyCalls(host_call, 0);
      assertSpyCalls(console_log, 1);
      assertSpyCallArgs(console_log, 0, [
        "A denops plugin 'dummyValid' is already loaded. Skip",
      ]);
    },
  );

  await t.step(
    "the result promise of waitLoaded() become 'pending' when the plugin is loaded but unload() was called during the loading",
    async () => {
      using host_call = stub(host, "call");
      const waitLoaded = service.waitLoaded("dummyUnloadDuringLoading");
      const loadPromise = service.load("dummyUnloadDuringLoading", scriptValid);
      const unloadPromise = service.unload("dummyUnloadDuringLoading");
      await Promise.all([loadPromise, unloadPromise]);
      assertEquals(await promiseState(waitLoaded), "pending");
      assertSpyCalls(host_call, 5);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyUnloadDuringLoading",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "echo 'Hello, Denops!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyUnloadDuringLoading",
        {},
      ]);
      assertSpyCallArgs(host_call, 3, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyUnloadDuringLoading",
        {},
      ]);
      assertSpyCallArgs(host_call, 4, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyUnloadDuringLoading",
        {},
      ]);
    },
  );

  await t.step(
    "the result promise of waitLoaded() become 'rejected' when the plugin is loaded but unload() was called during the loading (failure)",
    async () => {
      using host_call = stub(host, "call");
      using console_error = stub(console, "error");
      const waitLoaded = service.waitLoaded("dummyInvalidUnloadDuringLoading");
      const loadPromise = service.load(
        "dummyInvalidUnloadDuringLoading",
        scriptInvalidMain,
      );
      const unloadPromise = service.unload("dummyInvalidUnloadDuringLoading");
      await Promise.all([loadPromise, unloadPromise]);
      assertEquals(await promiseState(waitLoaded), "rejected");
      const actual = await assertRejects(() => waitLoaded);
      assertEquals(actual, "DenopsPluginFail:dummyInvalidUnloadDuringLoading");
      assertSpyCalls(host_call, 3);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyInvalidUnloadDuringLoading",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "echo 'I will throw an Error!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginFail:dummyInvalidUnloadDuringLoading",
        {},
      ]);
      assertSpyCalls(console_error, 1);
      assertSpyCallArgs(console_error, 0, [
        "Failed to load plugin 'dummyInvalidUnloadDuringLoading': Error: This is dummy error",
      ]);
    },
  );

  {
    using _host_call = stub(host, "call");
    await service.load("dummyValidDispose", scriptValidDispose);
    await service.load("dummyValidWillUnload", scriptValidDispose);
    await service.load("dummyInvalidDisposeWillUnload", scriptInvalidDispose);
    await service.load("dummyInvalidDispose", scriptInvalidDispose);
  }

  await t.step("unload() unloads plugin and emits autocmd events", async () => {
    using host_call = stub(host, "call");
    await service.unload("dummyValidWillUnload");
    assertSpyCalls(host_call, 3);
    assertSpyCallArgs(host_call, 0, [
      "denops#api#cmd",
      "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyValidWillUnload",
      {},
    ]);
    assertSpyCallArgs(host_call, 1, [
      "denops#api#cmd",
      "echo 'Goodbye, Denops!'",
      {},
    ]);
    assertSpyCallArgs(host_call, 2, [
      "denops#api#cmd",
      "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyValidWillUnload",
      {},
    ]);
  });

  await t.step(
    "unload() unloads plugin and emits autocmd events (dispose failure)",
    async () => {
      using host_call = stub(host, "call");
      using console_error = stub(console, "error");
      await service.unload("dummyInvalidDisposeWillUnload");
      assertSpyCalls(host_call, 2);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyInvalidDisposeWillUnload",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadFail:dummyInvalidDisposeWillUnload",
        {},
      ]);
      assertSpyCalls(console_error, 1);
      assertSpyCallArgs(console_error, 0, [
        "Failed to unload plugin 'dummyInvalidDisposeWillUnload': Error: This is dummy error in async dispose",
      ]);
    },
  );

  await t.step(
    "unload() does nothing when the plugin is not loaded yet",
    async () => {
      using host_call = stub(host, "call");
      using console_log = stub(console, "log");
      await service.unload("pluginthatisnotloaded");
      assertSpyCalls(host_call, 0);
      assertSpyCalls(console_log, 1);
      assertSpyCallArgs(console_log, 0, [
        "A denops plugin 'pluginthatisnotloaded' is not loaded yet. Skip",
      ]);
    },
  );

  await t.step(
    "unload() does nothing when the plugin is already unloaded",
    async () => {
      using host_call = stub(host, "call");
      using console_log = stub(console, "log");
      await service.unload("dummyValidWillUnload");
      assertSpyCalls(host_call, 0);
      assertSpyCalls(console_log, 1);
      assertSpyCallArgs(console_log, 0, [
        "A denops plugin 'dummyValidWillUnload' is not loaded yet. Skip",
      ]);
    },
  );

  await t.step("reload() reloads plugin and emits autocmd events", async () => {
    using host_call = stub(host, "call");
    await service.reload("dummyValid");
    assertSpyCalls(host_call, 5);
    assertSpyCallArgs(host_call, 0, [
      "denops#api#cmd",
      "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyValid",
      {},
    ]);
    assertSpyCallArgs(host_call, 1, [
      "denops#api#cmd",
      "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyValid",
      {},
    ]);
    assertSpyCallArgs(host_call, 2, [
      "denops#api#cmd",
      "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyValid",
      {},
    ]);
    assertSpyCallArgs(host_call, 3, [
      "denops#api#cmd",
      "echo 'Hello, Denops!'",
      {},
    ]);
    assertSpyCallArgs(host_call, 4, [
      "denops#api#cmd",
      "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyValid",
      {},
    ]);
  });

  await t.step(
    "reload() reloads plugin and emits autocmd events (dispose)",
    async () => {
      using host_call = stub(host, "call");
      await service.reload("dummyValidDispose");
      assertSpyCalls(host_call, 5);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyValidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "echo 'Goodbye, Denops!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyValidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 3, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyValidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 4, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyValidDispose",
        {},
      ]);
    },
  );

  await t.step(
    "reload() reloads plugin and emits autocmd events (dispose failure)",
    async () => {
      using host_call = stub(host, "call");
      using console_error = stub(console, "error");
      await service.reload("dummyInvalidDispose");
      assertSpyCalls(host_call, 4);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyInvalidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadFail:dummyInvalidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyInvalidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 3, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyInvalidDispose",
        {},
      ]);
      assertSpyCalls(console_error, 1);
      assertSpyCallArgs(console_error, 0, [
        "Failed to unload plugin 'dummyInvalidDispose': Error: This is dummy error in async dispose",
      ]);
    },
  );

  await t.step(
    "reload() does nothing when the plugin is not loaded yet",
    async () => {
      using host_call = stub(host, "call");
      using console_log = stub(console, "log");
      await service.reload("pluginthatisnotloaded");
      assertSpyCalls(host_call, 0);
      assertSpyCalls(console_log, 1);
      assertSpyCallArgs(console_log, 0, [
        "A denops plugin 'pluginthatisnotloaded' is not loaded yet. Skip",
      ]);
    },
  );

  await t.step(
    "reload() does nothing when the plugin is already unloaded",
    async () => {
      using host_call = stub(host, "call");
      using console_log = stub(console, "log");
      await service.reload("dummyValidWillUnload");
      assertSpyCalls(host_call, 0);
      assertSpyCalls(console_log, 1);
      assertSpyCallArgs(console_log, 0, [
        "A denops plugin 'dummyValidWillUnload' is not loaded yet. Skip",
      ]);
    },
  );

  let scriptRewrite: string | undefined;
  if (tempFile.path != null) {
    using _host_call = stub(host, "call");
    try {
      scriptRewrite = toFileUrl(tempFile.path).href;
      const sourceOriginal = await Deno.readTextFile(
        new URL(scriptRewriteBase),
      );
      await Deno.writeTextFile(new URL(scriptRewrite), sourceOriginal);
      await service.load("dummyWillRewrite", scriptRewrite);
      const sourceRewrited = sourceOriginal.replaceAll(
        " Denops!",
        " Rewrited!",
      );
      await Deno.writeTextFile(new URL(scriptRewrite), sourceRewrited);
    } catch (e) {
      console.error(e);
      scriptRewrite = undefined;
    }
  }

  await t.step({
    name:
      "reload(..., { forceReload: true }) reloads plugin whose file have changed",
    ignore: scriptRewrite == null,
    async fn() {
      using host_call = stub(host, "call");
      await service.reload("dummyWillRewrite", { forceReload: true });
      assertSpyCalls(host_call, 6);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyWillRewrite",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "echo 'Goodbye, Denops!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyWillRewrite",
        {},
      ]);
      assertSpyCallArgs(host_call, 3, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyWillRewrite",
        {},
      ]);
      assertSpyCallArgs(host_call, 4, [
        "denops#api#cmd",
        "echo 'Hello, Rewrited!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 5, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyWillRewrite",
        {},
      ]);
    },
  });

  if (scriptRewrite != null) {
    using _host_call = stub(host, "call");
    try {
      const sourceOriginal = await Deno.readTextFile(
        new URL(scriptRewriteBase),
      );
      const sourceRewrited = sourceOriginal.replaceAll(
        " Denops!",
        " Rewrited Twice!",
      );
      await Deno.writeTextFile(new URL(scriptRewrite), sourceRewrited);
    } catch (e) {
      console.error(e);
      scriptRewrite = undefined;
    }
  }

  await t.step({
    name: "reload() reloads plugin with cached",
    ignore: scriptRewrite == null,
    async fn() {
      using host_call = stub(host, "call");
      await service.reload("dummyWillRewrite");
      assertSpyCalls(host_call, 6);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyWillRewrite",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "echo 'Goodbye, Rewrited!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyWillRewrite",
        {},
      ]);
      assertSpyCallArgs(host_call, 3, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyWillRewrite",
        {},
      ]);
      assertSpyCallArgs(host_call, 4, [
        "denops#api#cmd",
        "echo 'Hello, Rewrited!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 5, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyWillRewrite",
        {},
      ]);
    },
  });

  if (scriptRewrite != null) {
    using _host_call = stub(host, "call");
    try {
      await service.unload("dummyWillRewrite");
    } catch (e) {
      console.error(e);
    }
  }

  await t.step({
    name: "load() loads plugin with cached",
    ignore: scriptRewrite == null,
    async fn() {
      using host_call = stub(host, "call");
      await service.load("dummyWillRewrite", scriptRewrite!);
      assertSpyCalls(host_call, 3);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyWillRewrite",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "echo 'Hello, Rewrited!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyWillRewrite",
        {},
      ]);
    },
  });

  if (scriptRewrite != null) {
    using _host_call = stub(host, "call");
    try {
      await service.unload("dummyWillRewrite");
    } catch (e) {
      console.error(e);
    }
  }

  await t.step({
    name:
      "load(..., { forceReload: true }) loads plugin whose file have changed",
    ignore: scriptRewrite == null,
    async fn() {
      using host_call = stub(host, "call");
      await service.load("dummyWillRewrite", scriptRewrite!, {
        forceReload: true,
      });
      assertSpyCalls(host_call, 3);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyWillRewrite",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "echo 'Hello, Rewrited Twice!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummyWillRewrite",
        {},
      ]);
    },
  });

  if (scriptRewrite != null) {
    using _host_call = stub(host, "call");
    try {
      await service.unload("dummyWillRewrite");
    } catch (e) {
      console.error(e);
    }
  }

  await t.step("dispatch() call API of a plugin", async () => {
    using host_call = stub(host, "call");
    await service.dispatch("dummyValid", "test", ["foo"]);
    assertSpyCalls(host_call, 1);
    assertSpyCallArgs(host_call, 0, [
      "denops#api#cmd",
      "echo 'This is test call: [\"foo\"]'",
      {},
    ]);
  });

  await t.step(
    "dispatch() rejects when the plugin is not loaded yet",
    async () => {
      const err = await assertRejects(
        () => service.dispatch("pluginthatisnotloaded", "test", ["foo"]),
      );
      assert(typeof err === "string");
      assertMatch(err, /No plugin 'pluginthatisnotloaded' is loaded/);
    },
  );

  await t.step(
    "dispatch() rejects when failed to call plugin API",
    async () => {
      using host_call = stub(
        host,
        "call",
        () => Promise.reject(new Error("invalid call")),
      );
      const err = await assertRejects(
        () => service.dispatch("dummyValid", "test", ["foo"]),
      );
      assertSpyCalls(host_call, 1);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "echo 'This is test call: [\"foo\"]'",
        {},
      ]);
      assert(typeof err === "string");
      assertMatch(err, /invalid call/);
    },
  );

  await t.step(
    "dispatchAsync() call success callback when API call is succeeded",
    async () => {
      using host_call = stub(host, "call");
      await service.dispatchAsync(
        "dummyValid",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(host_call, 2);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "echo 'This is test call: [\"foo\"]'",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#callback#call",
        "success",
        undefined,
      ]);
    },
  );

  await t.step(
    "dispatchAsync() call failure callback when API call is failed",
    async () => {
      using host_call = stub(
        host,
        "call",
        (method) =>
          method === "denops#api#cmd"
            ? Promise.reject(new Error("invalid call"))
            : Promise.resolve(),
      );
      await service.dispatchAsync(
        "dummyValid",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(host_call, 2);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "echo 'This is test call: [\"foo\"]'",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#callback#call",
        "failure",
        host_call.calls[1].args[2],
      ]);
      assertInstanceOf(host_call.calls[1].args[2], Object);
      assertObjectMatch(host_call.calls[1].args[2], {
        message: "invalid call",
        name: "Error",
      });
    },
  );

  await t.step(
    "dispatchAsync() call failure callback when API call is failed (throws not an Error)",
    async () => {
      using host_call = stub(
        host,
        "call",
        (method) =>
          method === "denops#api#cmd" ? Promise.reject(123) : Promise.resolve(),
      );
      await service.dispatchAsync(
        "dummyValid",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(host_call, 2);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "echo 'This is test call: [\"foo\"]'",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#callback#call",
        "failure",
        host_call.calls[1].args[2],
      ]);
      assertInstanceOf(host_call.calls[1].args[2], Object);
      assertObjectMatch(host_call.calls[1].args[2], {
        message: "123",
        name: "number",
      });
    },
  );

  await t.step(
    "dispatchAsync() call success callback when API call is succeeded (but fail)",
    async () => {
      using host_call = stub(
        host,
        "call",
        (method) =>
          method !== "denops#api#cmd"
            ? Promise.reject(new Error("invalid call"))
            : Promise.resolve(),
      );
      using console_error = stub(console, "error");
      await service.dispatchAsync(
        "dummyValid",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(host_call, 2);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "echo 'This is test call: [\"foo\"]'",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#callback#call",
        "success",
        undefined,
      ]);
      assertSpyCalls(console_error, 1);
      assertSpyCallArgs(console_error, 0, [
        "Failed to call success callback 'success': Error: invalid call",
      ]);
    },
  );

  await t.step(
    "dispatchAsync() call failure callback when API call is failed (but fail)",
    async () => {
      using host_call = stub(
        host,
        "call",
        () => Promise.reject(new Error("invalid call")),
      );
      using console_error = stub(console, "error");
      await service.dispatchAsync(
        "dummyValid",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(host_call, 2);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "echo 'This is test call: [\"foo\"]'",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#callback#call",
        "failure",
        host_call.calls[1].args[2],
      ]);
      assertInstanceOf(host_call.calls[1].args[2], Object);
      assertObjectMatch(host_call.calls[1].args[2], {
        message: "invalid call",
        name: "Error",
      });
      assertSpyCalls(console_error, 1);
      assertSpyCallArgs(console_error, 0, [
        "Failed to call failure callback 'failure': Error: invalid call",
      ]);
    },
  );

  {
    using _host_call = stub(host, "call");
    await service.load("dummyLast", scriptValid);
  }

  const waitLoadedCalledBeforeClose = service.waitLoaded(
    "whenclosedtestplugin",
  );
  const waitClosedCalledBeforeClose = service.waitClosed();

  await t.step(
    "the result promise of waitClosed() become 'pending' when the service is not closed",
    async () => {
      assert(await promiseState(waitClosedCalledBeforeClose), "pending");
    },
  );

  await t.step(
    "close() unloads all plugins",
    async () => {
      using host_call = stub(host, "call");
      using console_error = stub(console, "error");
      await service.close();
      assertSpyCalls(host_call, 9);
      assertSpyCallArgs(host_call, 0, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyValid",
        {},
      ]);
      assertSpyCallArgs(host_call, 1, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyValidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 2, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyInvalidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 3, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPre:dummyLast",
        {},
      ]);
      assertSpyCallArgs(host_call, 4, [
        "denops#api#cmd",
        "echo 'Goodbye, Denops!'",
        {},
      ]);
      assertSpyCallArgs(host_call, 5, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadFail:dummyInvalidDispose",
        {},
      ]);
      assertSpyCallArgs(host_call, 6, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyValid",
        {},
      ]);
      assertSpyCallArgs(host_call, 7, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyLast",
        {},
      ]);
      assertSpyCallArgs(host_call, 8, [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginUnloadPost:dummyValidDispose",
        {},
      ]);
      assertSpyCalls(console_error, 1);
      assertSpyCallArgs(console_error, 0, [
        "Failed to unload plugin 'dummyInvalidDispose': Error: This is dummy error in async dispose",
      ]);
    },
  );

  await t.step(
    "the result promise of waitLoaded() become 'rejected' when the service is closed",
    async () => {
      assertEquals(await promiseState(waitLoadedCalledBeforeClose), "rejected");
      const actual = await assertRejects(() => waitLoadedCalledBeforeClose);
      assertEquals(actual, "DenopsClosed");
    },
  );

  await t.step(
    "the result promise of waitClosed() become 'fulfilled' when the service is closed",
    async () => {
      assert(await promiseState(waitClosedCalledBeforeClose), "fulfilled");
    },
  );

  await t.step(
    "waitLoaded() returns 'rejected' promise if the service is already closed",
    async () => {
      const actual = await assertRejects(() =>
        service.waitLoaded("afterclosedtestplugin")
      );
      assertEquals(actual, "DenopsClosed");
    },
  );

  await t.step(
    "waitClosed() returns 'fulfilled' promise if the service is already closed",
    async () => {
      const actual = service.waitClosed();
      assert(await promiseState(actual), "fulfilled");
    },
  );

  await t.step(
    "load() rejects an error when the service is closed",
    async () => {
      await assertRejects(
        () => service.load("dummyValid", scriptValid),
        Error,
        "No host is bound to the service",
      );
    },
  );

  await t.step("[@@asyncDispose]() calls close()", async () => {
    using service_close = stub(service, "close");
    await service[Symbol.asyncDispose]();
    assertSpyCalls(service_close, 1);
  });
});
