import { assertEquals, assertStrictEquals, clone } from "./deps_test.ts";
import { context, updateContext } from "./context.ts";

const defaultContext = clone(context);

Deno.test("updateContext() returns the context", () => {
  try {
    const r = updateContext({});
    assertStrictEquals(r, context);
  } finally {
    updateContext(defaultContext);
  }
});
Deno.test("updateContext() should update the global context", () => {
  try {
    updateContext({
      mode: "vim",
      debug: true,
    });
    assertEquals(context.mode, "vim");
    assertEquals(context.debug, true);
  } finally {
    updateContext(defaultContext);
  }
});
Deno.test(
  "updateContext() does not touch keys which value is undefined",
  () => {
    try {
      updateContext({
        mode: undefined,
        debug: true,
      });
      assertEquals(context.mode, "neovim");
      assertEquals(context.debug, true);
    } finally {
      updateContext(defaultContext);
    }
  },
);
