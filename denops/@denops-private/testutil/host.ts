import { Host } from "../host.ts";
import { Neovim } from "../host/nvim.ts";
import { Vim } from "../host/vim.ts";
import { withNeovim, WithOptions, withVim } from "./with.ts";

export type HostFn<T> = (host: Host) => Promise<T>;

export type WithHostOptions<T> = Omit<WithOptions<T>, "fn"> & {
  mode: "vim" | "nvim";
  fn: HostFn<T>;
};

export function withHost<T>(
  options: WithHostOptions<T>,
): Promise<T> {
  const { mode, fn, ...withOptions } = options;
  if (mode === "vim") {
    return withVim({
      fn: async (reader, writer) => {
        await using host = new Vim(reader, writer);
        return await fn(host);
      },
      ...withOptions,
    });
  }
  if (mode === "nvim") {
    return withNeovim({
      fn: async (reader, writer) => {
        await using host = new Neovim(reader, writer);
        return await fn(host);
      },
      ...withOptions,
    });
  }
  return Promise.reject(new TypeError(`Invalid mode: ${mode}`));
}

export type TestFn = (host: Host, t: Deno.TestContext) => Promise<void>;

export type TestHostOptions = Omit<WithHostOptions<void>, "mode" | "fn"> & {
  mode?: "vim" | "nvim" | "all";
  name?: string;
  fn: TestFn;
};

export function testHost(
  options: TestHostOptions,
): void {
  const { mode = "all", fn, name, ...hostOptions } = options;
  if (mode === "all") {
    testHost({ ...options, mode: "vim" });
    testHost({ ...options, mode: "nvim" });
  } else if (mode === "vim" || mode === "nvim") {
    const prefix = name ? `${name} ` : "";
    Deno.test(`${prefix}(${mode})`, async (t) => {
      await withHost({
        mode,
        fn: (host) => fn(host, t),
        ...hostOptions,
      });
    });
  } else {
    throw new TypeError(`Invalid mode: ${mode}`);
  }
}
