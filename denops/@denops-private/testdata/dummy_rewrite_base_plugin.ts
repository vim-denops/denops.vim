// deno-lint-ignore-file no-explicit-any
// NOTE: This file may be copied to a temporary directory during testing, so to avoid type checking, not import any modules, and allow any type.

export const main = async (denops: any) => {
  await denops.cmd("echo 'Hello, Denops!'");
  return {
    [Symbol.asyncDispose]: async () => {
      await denops.cmd("echo 'Goodbye, Denops!'");
    },
  };
};
