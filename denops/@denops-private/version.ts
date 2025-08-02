import { dirname } from "@std/path/dirname";
import { fromFileUrl } from "@std/path/from-file-url";
import type { SemVer } from "@std/semver/types";
import { parse } from "@std/semver/parse";

const decoder = new TextDecoder();

export async function getVersionOr<T>(fallback: T): Promise<SemVer | T> {
  const cwd = dirname(fromFileUrl(import.meta.url));
  const command = new Deno.Command("git", {
    args: ["describe", "--tags", "--always"],
    cwd,
    stdin: "null",
    stdout: "piped",
    stderr: "null",
  });
  const { success, stdout } = await command.output();
  try {
    if (!success) {
      return fallback;
    }
    return parse(decoder.decode(stdout).trim());
  } catch {
    return fallback;
  }
}
