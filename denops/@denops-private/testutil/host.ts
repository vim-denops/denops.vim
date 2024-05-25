import { Host } from "../host.ts";
import { Neovim } from "../host/nvim.ts";
import { Vim } from "../host/vim.ts";
import { withNeovim, WithOptions, withVim } from "./with.ts";

export type HostFn<T> = (host: Host) => T;

export interface WithHostOptions<T> extends Omit<WithOptions<T>, "fn"> {
  fn: HostFn<T>;
  /** Run mode. */
  mode: "vim" | "nvim";
}

export function withHost<T>(
  options: WithHostOptions<T>,
): Promise<Awaited<T>> {
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

export type TestFn = (host: Host, t: Deno.TestContext) => void | Promise<void>;

export interface TestHostOptions
  extends
    Omit<WithHostOptions<void | Promise<void>>, "fn" | "mode">,
    Pick<Deno.TestDefinition, "ignore" | "only"> {
  fn: TestFn;
  /** Test mode. */
  mode?: "vim" | "nvim" | "all";
  /** Test name. */
  name?: string;
}

export function testHost(
  options: TestHostOptions,
): void {
  const { mode = "all", fn, name, ignore, only, ...hostOptions } = options;
  if (mode === "all") {
    testHost({ ...options, mode: "vim" });
    testHost({ ...options, mode: "nvim" });
  } else if (mode === "vim" || mode === "nvim") {
    const prefix = name ? `${name} ` : "";
    Deno.test({
      ignore,
      only,
      name: `${prefix}(${mode})`,
      fn: async (t) => {
        await withHost<void | Promise<void>>({
          mode,
          fn: (host) => fn(host, t),
          ...hostOptions,
        });
      },
    });
  } else {
    throw new TypeError(`Invalid mode: ${mode}`);
  }
}