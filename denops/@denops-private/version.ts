import { dirname } from "jsr:@std/path@0.225.0/dirname";
import { fromFileUrl } from "jsr:@std/path@0.225.0/from-file-url";
import type { SemVer } from "jsr:@std/semver@0.224.0/types";
import { parse } from "jsr:@std/semver@0.224.0/parse";

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
