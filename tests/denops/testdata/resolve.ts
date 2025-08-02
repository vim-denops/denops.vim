import { join } from "@std/path/join";

/** Resolve testdata script path. */
export function resolveTestDataPath(path: string): string {
  return join(import.meta.dirname!, path);
}

/** Resolve testdata script URL. */
export function resolveTestDataURL(path: string): string {
  return new URL(path, import.meta.url).href;
}
