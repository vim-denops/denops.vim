// TODO: #349 Update `Entrypoint` in denops-core, remove this module from `$.test.exclude` in `deno.jsonc`, and remove this module.
import type { Denops } from "jsr:@denops/core@6.1.0";

/**
 * Denops's entrypoint definition.
 *
 * Use this type to ensure the `main` function is properly implemented like:
 *
 * ```ts
 * import type { Entrypoint } from "jsr:@denops/core";
 *
 * export const main: Entrypoint = (denops) => {
 *   // ...
 * }
 * ```
 *
 * If an `AsyncDisposable` object is returned, resources can be disposed of
 * asynchronously when the plugin is unloaded, like:
 *
 * ```ts
 * import type { Entrypoint } from "jsr:@denops/core";
 *
 * export const main: Entrypoint = (denops) => {
 *   // ...
 *   return {
 *     [Symbol.asyncDispose]: () => {
 *       // Dispose resources...
 *     }
 *   }
 * }
 * ```
 */
export type Entrypoint = (
  denops: Denops,
) => void | AsyncDisposable | Promise<void | AsyncDisposable>;
