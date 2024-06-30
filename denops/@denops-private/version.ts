import {
  dirname,
  fromFileUrl,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import { parse, SemVer } from "https://deno.land/std@0.224.0/semver/mod.ts";

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
