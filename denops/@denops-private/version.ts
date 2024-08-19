import { dirname } from "jsr:@std/path@^1.0.2/dirname";
import { fromFileUrl } from "jsr:@std/path@^1.0.2/from-file-url";
import type { SemVer } from "jsr:@std/semver@^1.0.1/types";
import { parse } from "jsr:@std/semver@^1.0.1/parse";

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
