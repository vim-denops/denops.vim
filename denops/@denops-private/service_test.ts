import {
  assert,
  assertEquals,
  assertMatch,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert@0.225.1";
import {
  assertSpyCall,
  assertSpyCalls,
  stub,
} from "jsr:@std/testing@0.224.0/mock";
import type { Meta } from "jsr:@denops/core@6.0.6";
import { promiseState } from "jsr:@lambdalisue/async@2.1.1";
import { unimplemented } from "jsr:@lambdalisue/errorutil@1.0.0";
import type { Host } from "./denops.ts";
import { Service } from "./service.ts";

const scriptValid =
  new URL("./testdata/dummy_valid_plugin.ts", import.meta.url).href;
const scriptInvalid =
  new URL("./testdata/dummy_invalid_plugin.ts", import.meta.url).href;
const scriptInvalidConstraint =
  new URL("./testdata/dummy_invalid_constraint_plugin.ts", import.meta.url)
    .href;
const scriptInvalidConstraint2 =
  new URL("./testdata/dummy_invalid_constraint_plugin2.ts", import.meta.url)
    .href;

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

  await t.step("load() rejects an error when no host is bound", async () => {
    await assertRejects(
      () => service.load("dummy", scriptValid),
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
            "dummy",
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

  const waitLoaded = service.waitLoaded("dummy");

  await t.step(
    "the result promise of waitLoaded() is 'pending' when the plugin is not loaded yet",
    async () => {
      assertEquals(await promiseState(waitLoaded), "pending");
    },
  );

  await t.step("load() loads plugin and emits autocmd events", async () => {
    using s = stub(host, "call");
    await service.load("dummy", scriptValid);
    assertSpyCalls(s, 3);
    assertSpyCall(s, 0, {
      args: [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
        {},
      ],
    });
    assertSpyCall(s, 1, {
      args: [
        "denops#api#cmd",
        "echo 'Hello, Denops!'",
        {},
      ],
    });
    assertSpyCall(s, 2, {
      args: [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummy",
        {},
      ],
    });
  });

  await t.step(
    "the result promise of waitLoaded() become 'fulfilled' when the plugin is loaded",
    async () => {
      assertEquals(await promiseState(waitLoaded), "fulfilled");
    },
  );

  await t.step(
    "load() loads plugin and emits autocmd events (failure)",
    async () => {
      using c = stub(console, "error");
      using s = stub(host, "call");
      await service.load("dummyFail", scriptInvalid);
      assertSpyCalls(c, 1);
      assertSpyCall(c, 0, {
        args: [
          "Failed to load plugin 'dummyFail': Error: This is dummy error",
        ],
      });
      assertSpyCalls(s, 2);
      assertSpyCall(s, 0, {
        args: [
          "denops#api#cmd",
          "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyFail",
          {},
        ],
      });
      assertSpyCall(s, 1, {
        args: [
          "denops#api#cmd",
          "doautocmd <nomodeline> User DenopsSystemPluginFail:dummyFail",
          {},
        ],
      });
    },
  );

  await t.step(
    "load() loads plugin and emits autocmd events (could not find constraint)",
    async () => {
      using c = stub(console, "warn");
      using s = stub(host, "call");
      await service.load("dummyFailConstraint", scriptInvalidConstraint);
      const expects = [
        "********************************************************************************",
        "Deno module cache issue is detected.",
        "Execute 'call denops#cache#update(#{reload: v:true})' and restart Vim/Neovim.",
        "See https://github.com/vim-denops/denops.vim/issues/358 for more detail.",
        "********************************************************************************",
      ];
      assertSpyCalls(c, expects.length);
      for (let i = 0; i < expects.length; i++) {
        assertSpyCall(c, i, {
          args: [expects[i]],
        });
      }
      assertSpyCalls(s, 2);
      assertSpyCall(s, 0, {
        args: [
          "denops#api#cmd",
          "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyFailConstraint",
          {},
        ],
      });
      assertSpyCall(s, 1, {
        args: [
          "denops#api#cmd",
          "doautocmd <nomodeline> User DenopsSystemPluginFail:dummyFailConstraint",
          {},
        ],
      });
    },
  );

  await t.step(
    "load() loads plugin and emits autocmd events (could not find version)",
    async () => {
      using c = stub(console, "warn");
      using s = stub(host, "call");
      await service.load("dummyFailConstraint2", scriptInvalidConstraint2);
      const expects = [
        "********************************************************************************",
        "Deno module cache issue is detected.",
        "Execute 'call denops#cache#update(#{reload: v:true})' and restart Vim/Neovim.",
        "See https://github.com/vim-denops/denops.vim/issues/358 for more detail.",
        "********************************************************************************",
      ];
      assertSpyCalls(c, expects.length);
      for (let i = 0; i < expects.length; i++) {
        assertSpyCall(c, i, {
          args: [expects[i]],
        });
      }
      assertSpyCalls(s, 2);
      assertSpyCall(s, 0, {
        args: [
          "denops#api#cmd",
          "doautocmd <nomodeline> User DenopsSystemPluginPre:dummyFailConstraint2",
          {},
        ],
      });
      assertSpyCall(s, 1, {
        args: [
          "denops#api#cmd",
          "doautocmd <nomodeline> User DenopsSystemPluginFail:dummyFailConstraint2",
          {},
        ],
      });
    },
  );

  await t.step(
    "load() does nothing when the plugin is already loaded",
    async () => {
      using s1 = stub(host, "call");
      using s2 = stub(console, "log");
      await service.load("dummy", scriptValid);
      assertSpyCalls(s1, 0);
      assertSpyCalls(s2, 1);
      assertSpyCall(s2, 0, {
        args: [
          "A denops plugin 'dummy' is already loaded. Skip",
        ],
      });
    },
  );

  await t.step("reload() reloads plugin and emits autocmd events", async () => {
    using s = stub(host, "call");
    await service.reload("dummy");
    assertSpyCalls(s, 3);
    assertSpyCall(s, 1, {
      args: [
        "denops#api#cmd",
        "echo 'Hello, Denops!'",
        {},
      ],
    });
    assertSpyCall(s, 2, {
      args: [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummy",
        {},
      ],
    });
  });

  await t.step(
    "load() does nothing when the plugin is already loaded",
    async () => {
      using s1 = stub(host, "call");
      using s2 = stub(console, "log");
      await service.load("dummy", scriptValid);
      assertSpyCalls(s1, 0);
      assertSpyCalls(s2, 1);
      assertSpyCall(s2, 0, {
        args: [
          "A denops plugin 'dummy' is already loaded. Skip",
        ],
      });
    },
  );

  await t.step("reload() reloads plugin and emits autocmd events", async () => {
    using s = stub(host, "call");
    await service.reload("dummy");
    assertSpyCalls(s, 3);
    assertSpyCall(s, 0, {
      args: [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPre:dummy",
        {},
      ],
    });
    assertSpyCall(s, 1, {
      args: [
        "denops#api#cmd",
        "echo 'Hello, Denops!'",
        {},
      ],
    });
    assertSpyCall(s, 2, {
      args: [
        "denops#api#cmd",
        "doautocmd <nomodeline> User DenopsSystemPluginPost:dummy",
        {},
      ],
    });
  });

  await t.step(
    "reload() does nothing when the plugin is not loaded yet",
    async () => {
      using s1 = stub(host, "call");
      using s2 = stub(console, "log");
      await service.reload("pluginthatisnotloaded");
      assertSpyCalls(s1, 0);
      assertSpyCalls(s2, 1);
      assertSpyCall(s2, 0, {
        args: [
          "A denops plugin 'pluginthatisnotloaded' is not loaded yet. Skip",
        ],
      });
    },
  );

  await t.step("dispatch() call API of a plugin", async () => {
    using s = stub(host, "call");
    await service.dispatch("dummy", "test", ["foo"]);
    assertSpyCalls(s, 1);
    assertSpyCall(s, 0, {
      args: [
        "denops#api#cmd",
        "echo 'This is test call: [\"foo\"]'",
        {},
      ],
    });
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
      using s = stub(
        host,
        "call",
        () => Promise.reject(new Error("invalid call")),
      );
      const err = await assertRejects(
        () => service.dispatch("dummy", "test", ["foo"]),
      );
      assertSpyCalls(s, 1);
      assertSpyCall(s, 0, {
        args: [
          "denops#api#cmd",
          "echo 'This is test call: [\"foo\"]'",
          {},
        ],
      });
      assert(typeof err === "string");
      assertMatch(err, /invalid call/);
    },
  );

  await t.step(
    "dispatchAsync() call success callback when API call is succeeded",
    async () => {
      using s = stub(host, "call");
      await service.dispatchAsync(
        "dummy",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(s, 2);
      assertSpyCall(s, 0, {
        args: [
          "denops#api#cmd",
          "echo 'This is test call: [\"foo\"]'",
          {},
        ],
      });
      assertSpyCall(s, 1, {
        args: [
          "denops#callback#call",
          "success",
          undefined,
        ],
      });
    },
  );

  await t.step(
    "dispatchAsync() call failure callback when API call is failed",
    async () => {
      using s = stub(
        host,
        "call",
        (method) =>
          method === "denops#api#cmd"
            ? Promise.reject(new Error("invalid call"))
            : Promise.resolve(),
      );
      await service.dispatchAsync(
        "dummy",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(s, 2);
      assertSpyCall(s, 0, {
        args: [
          "denops#api#cmd",
          "echo 'This is test call: [\"foo\"]'",
          {},
        ],
      });
      assertSpyCall(s, 1, {
        args: [
          "denops#callback#call",
          "failure",
          s.calls[1].args[2],
        ],
      });
    },
  );

  await t.step(
    "dispatchAsync() call success callback when API call is succeeded (but fail)",
    async () => {
      using s1 = stub(
        host,
        "call",
        (method) =>
          method !== "denops#api#cmd"
            ? Promise.reject(new Error("invalid call"))
            : Promise.resolve(),
      );
      using s2 = stub(console, "error");
      await service.dispatchAsync(
        "dummy",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(s1, 2);
      assertSpyCall(s1, 0, {
        args: [
          "denops#api#cmd",
          "echo 'This is test call: [\"foo\"]'",
          {},
        ],
      });
      assertSpyCall(s1, 1, {
        args: [
          "denops#callback#call",
          "success",
          undefined,
        ],
      });
      assertSpyCalls(s2, 1);
      assertSpyCall(s2, 0, {
        args: [
          "Failed to call success callback 'success': Error: invalid call",
        ],
      });
    },
  );

  await t.step(
    "dispatchAsync() call failure callback when API call is failed (but fail)",
    async () => {
      using s1 = stub(
        host,
        "call",
        () => Promise.reject(new Error("invalid call")),
      );
      using s2 = stub(console, "error");
      await service.dispatchAsync(
        "dummy",
        "test",
        ["foo"],
        "success",
        "failure",
      );
      assertSpyCalls(s1, 2);
      assertSpyCall(s1, 0, {
        args: [
          "denops#api#cmd",
          "echo 'This is test call: [\"foo\"]'",
          {},
        ],
      });
      assertSpyCall(s1, 1, {
        args: [
          "denops#callback#call",
          "failure",
          s1.calls[1].args[2],
        ],
      });
      assertSpyCalls(s2, 1);
      assertSpyCall(s2, 0, {
        args: [
          "Failed to call failure callback 'failure': Error: invalid call",
        ],
      });
    },
  );

  await t.step(
    "interrupt() sends interrupt signal to `interrupted` attribute",
    () => {
      const signal = service.interrupted;
      signal.throwIfAborted(); // Should not throw
      service.interrupt();
      assertThrows(() => signal.throwIfAborted());
    },
  );

  await t.step(
    "interrupt() sends interrupt signal to `interrupted` attribute with reason",
    () => {
      const signal = service.interrupted;
      signal.throwIfAborted(); // Should not throw
      service.interrupt("test");
      assertThrows(() => signal.throwIfAborted(), "test");
    },
  );
});
