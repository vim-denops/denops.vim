import {
  assert,
  assertEquals,
  assertMatch,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertSpyCall,
  assertSpyCalls,
  stub,
} from "https://deno.land/std@0.224.0/testing/mock.ts";
import type { Meta } from "https://deno.land/x/denops_core@v6.1.0/mod.ts";
import { promiseState } from "https://deno.land/x/async@v2.1.0/mod.ts";
import { unimplemented } from "https://deno.land/x/errorutil@v1.0.2/mod.ts";
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
    const s = stub(host, "call");
    try {
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
    } finally {
      s.restore();
    }
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
      const c = stub(console, "error");
      const s = stub(host, "call");
      try {
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
      } finally {
        s.restore();
        c.restore();
      }
    },
  );

  await t.step(
    "load() loads plugin and emits autocmd events (could not find constraint)",
    async () => {
      const c = stub(console, "warn");
      const s = stub(host, "call");
      try {
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
      } finally {
        s.restore();
        c.restore();
      }
    },
  );

  await t.step(
    "load() loads plugin and emits autocmd events (could not find version)",
    async () => {
      const c = stub(console, "warn");
      const s = stub(host, "call");
      try {
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
      } finally {
        s.restore();
        c.restore();
      }
    },
  );

  await t.step(
    "load() does nothing when the plugin is already loaded",
    async () => {
      const s1 = stub(host, "call");
      const s2 = stub(console, "log");
      try {
        await service.load("dummy", scriptValid);
        assertSpyCalls(s1, 0);
        assertSpyCalls(s2, 1);
        assertSpyCall(s2, 0, {
          args: [
            "A denops plugin 'dummy' is already loaded. Skip",
          ],
        });
      } finally {
        s1.restore();
        s2.restore();
      }
    },
  );

  await t.step("reload() reloads plugin and emits autocmd events", async () => {
    const s = stub(host, "call");
    try {
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
    } finally {
      s.restore();
    }
  });

  await t.step(
    "reload() does nothing when the plugin is not loaded yet",
    async () => {
      const s1 = stub(host, "call");
      const s2 = stub(console, "log");
      try {
        await service.reload("pluginthatisnotloaded");
        assertSpyCalls(s1, 0);
        assertSpyCalls(s2, 1);
        assertSpyCall(s2, 0, {
          args: [
            "A denops plugin 'pluginthatisnotloaded' is not loaded yet. Skip",
          ],
        });
      } finally {
        s1.restore();
        s2.restore();
      }
    },
  );

  await t.step("dispatch() call API of a plugin", async () => {
    const s = stub(host, "call");
    try {
      await service.dispatch("dummy", "test", ["foo"]);
      assertSpyCalls(s, 1);
      assertSpyCall(s, 0, {
        args: [
          "denops#api#cmd",
          "echo 'This is test call: [\"foo\"]'",
          {},
        ],
      });
    } finally {
      s.restore();
    }
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
      const s = stub(
        host,
        "call",
        () => Promise.reject(new Error("invalid call")),
      );
      try {
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
        assertMatch(err, /Failed to call 'test' API in 'dummy': invalid call/);
      } finally {
        s.restore();
      }
    },
  );

  await t.step(
    "dispatchAsync() call success callback when API call is succeeded",
    async () => {
      const s = stub(host, "call");
      try {
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
      } finally {
        s.restore();
      }
    },
  );

  await t.step(
    "dispatchAsync() call failure callback when API call is failed",
    async () => {
      const s = stub(
        host,
        "call",
        (method) =>
          method === "denops#api#cmd"
            ? Promise.reject(new Error("invalid call"))
            : Promise.resolve(),
      );
      try {
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
      } finally {
        s.restore();
      }
    },
  );

  await t.step(
    "dispatchAsync() call success callback when API call is succeeded (but fail)",
    async () => {
      const s1 = stub(
        host,
        "call",
        (method) =>
          method !== "denops#api#cmd"
            ? Promise.reject(new Error("invalid call"))
            : Promise.resolve(),
      );
      const s2 = stub(console, "error");
      try {
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
      } finally {
        s1.restore();
        s2.restore();
      }
    },
  );

  await t.step(
    "dispatchAsync() call failure callback when API call is failed (but fail)",
    async () => {
      const s1 = stub(
        host,
        "call",
        () => Promise.reject(new Error("invalid call")),
      );
      const s2 = stub(console, "error");
      try {
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
      } finally {
        s1.restore();
        s2.restore();
      }
    },
  );
});
