import {
  dirname,
  fromFileUrl,
} from "https://deno.land/std@0.210.0/path/mod.ts";
import { parse, SemVer } from "https://deno.land/std@0.210.0/semver/mod.ts";

const decoder = new TextDecoder();

export async function getVersion(): Promise<SemVer> {
  const cwd = dirname(fromFileUrl(import.meta.url));
  const command = new Deno.Command("git", {
    args: ["describe", "--tags", "--always"],
    cwd,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stdout, stderr } = await command.output();
  if (!success) {
    throw new Error(`failed to estimate version: ${decoder.decode(stderr)}`);
  }
  return parse(decoder.decode(stdout).trim());
}

export async function getVersionOr<T>(fallback: T): Promise<SemVer | T> {
  try {
    return await getVersion();
  } catch {
    return fallback;
  }
}
