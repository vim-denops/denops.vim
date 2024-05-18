import { assertEquals } from "jsr:@std/assert@0.225.2";
import { testHost } from "../../denops/@denops-private/testutil/host.ts";
import { wait } from "../../denops/@denops-private/testutil/wait.ts";

testHost({
  name: "denops#server#close() should fires DenopsClosed",
  fn: async (host) => {
    await host.call("execute", [
      "source plugin/denops.vim",
      "autocmd User DenopsReady let g:denops_ready_called = 1",
      "autocmd User DenopsClosed let g:denops_closed_called = 1",
    ], "");
    await wait(() => host.call("exists", "g:denops_ready_called"));
    assertEquals(await host.call("exists", "g:denops_closed_called"), 0);
    await host.call("denops#server#close");
    assertEquals(
      await wait(() => host.call("exists", "g:denops_closed_called")),
      1,
    );
  },
});
