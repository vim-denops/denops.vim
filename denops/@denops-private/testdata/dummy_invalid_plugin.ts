import type { Denops } from "jsr:@denops/core@6.0.6";

export function main(_denops: Denops): Promise<void> {
  throw new Error("This is dummy error");
}
