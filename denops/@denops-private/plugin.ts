// TODO: #349 Update `Entrypoint` in denops-core, remove this module from `$.test.exclude` in `deno.jsonc`, and remove this module.
import type { Denops } from "jsr:@denops/core@6.1.0";

/**
 * Denops's entrypoint definition.
 *
 * Use this type to ensure the `main` function is properly implemented like
 *
 * If an `AsyncDisposable` object is returned, its `obj[Symbol.asyncDispose]()`
 * will be called before the plugin is unloaded.
 *
 * ```ts
 * import type { Entrypoint } from "jsr:@denops/core@$MODULE_VERSION";
 *
 * export const main: Entrypoint = (denops) => {
 *   // ...
 *   return {
 *     [Symbol.asyncDispose]: async () => {
 *       // ...
 *     }
 *   }
 * }
 * ```
 */
export type Entrypoint = (
  denops: Denops,
) => void | AsyncDisposable | Promise<void | AsyncDisposable>;
