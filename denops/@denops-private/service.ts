import { toFileUrl } from "https://deno.land/std@0.204.0/path/mod.ts";
import { Disposable } from "https://deno.land/x/disposable@v1.2.0/mod.ts#^";
import { Host } from "./host/base.ts";
import { Invoker, RegisterOptions, ReloadOptions } from "./host/invoker.ts";
import type { Meta } from "../@denops/mod.ts";
import { DenopsImpl } from "./impl.ts";

/**
 * Service manage plugins and is visible from the host (Vim/Neovim) through `invoke()` function.
 */
export class Service implements Disposable {
  #plugins: Map<string, {
    script: string;
    denops: DenopsImpl;
  }>;
  host: Host;

  constructor(host: Host) {
    this.#plugins = new Map();
    this.host = host;
    this.host.register(new Invoker(this));
  }

  register(
    name: string,
    script: string,
    meta: Meta,
    options: RegisterOptions,
    _trace: boolean,
  ): void {
    const plugin = this.#plugins.get(name);
    if (plugin) {
      if (options.mode === "reload") {
        if (meta.mode === "debug") {
          console.log(
            `A denops plugin '${name}' is already registered. Reload`,
          );
        }
      } else if (options.mode === "skip") {
        if (meta.mode === "debug") {
          console.log(`A denops plugin '${name}' is already registered. Skip`);
        }
        return;
      } else {
        throw new Error(`A denops plugin '${name}' is already registered`);
      }
    }
    const denops = new DenopsImpl(name, meta, this);
    // Import module with fragment so that reload works properly
    // https://github.com/vim-denops/denops.vim/issues/227
    const suffix = `#${performance.now()}`;
    const scriptUrl = resolveScriptUrl(script);
    import(`${scriptUrl}${suffix}`).then(async (mod) => {
      try {
        await denops.cmd(
          `doautocmd <nomodeline> User DenopsSystemPluginPre:${name}`,
        )
          .catch((e) =>
            console.warn(
              `Failed to emit DenopsSystemPluginPre:${name}: ${e}`,
            )
          );
        await mod.main(denops);
        await denops.cmd(
          `doautocmd <nomodeline> User DenopsSystemPluginPost:${name}`,
        )
          .catch((e) =>
            console.warn(
              `Failed to emit DenopsSystemPluginPost:${name}: ${e}`,
            )
          );
      } catch (e) {
        console.error(e);
        await denops.cmd(
          `doautocmd <nomodeline> User DenopsSystemPluginFail:${name}`,
        )
          .catch((e) =>
            console.warn(
              `Failed to emit DenopsSystemPluginFail:${name}: ${e}`,
            )
          );
      }
    });
    this.#plugins.set(name, {
      script,
      denops,
    });
  }

  reload(
    name: string,
    meta: Meta,
    options: ReloadOptions,
    trace: boolean,
  ): void {
    const plugin = this.#plugins.get(name);
    if (!plugin) {
      if (options.mode === "skip") {
        if (meta.mode === "debug") {
          console.log(`A denops plugin '${name}' is not registered yet. Skip`);
        }
        return;
      } else {
        throw new Error(`A denops plugin '${name}' is not registered yet`);
      }
    }
    this.register(name, plugin.script, { ...meta, mode: "release" }, {
      mode: "reload",
    }, trace);
  }

  async dispatch(name: string, fn: string, args: unknown[]): Promise<unknown> {
    try {
      const plugin = this.#plugins.get(name);
      if (!plugin) {
        throw new Error(`No plugin '${name}' is registered`);
      }
      return await plugin.denops.dispatcher[fn](...args);
    } catch (e) {
      // NOTE:
      // Vim/Neovim does not handle JavaScript Error instance thus use string instead
      throw `${e.stack ?? e.toString()}`;
    }
  }

  async dispose(): Promise<void> {
    // Do nothing
  }
}

function resolveScriptUrl(script: string): string {
  try {
    return toFileUrl(script).href;
  } catch {
    return new URL(script, import.meta.url).href;
  }
}
