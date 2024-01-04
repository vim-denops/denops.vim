import { toFileUrl } from "https://deno.land/std@0.210.0/path/mod.ts";
import type { Denops } from "https://deno.land/x/denops_core@v5.0.0/mod.ts";

export class Plugin {
  #denops: Denops;

  readonly name: string;
  readonly script: string;

  constructor(denops: Denops, name: string, script: string) {
    this.#denops = denops;
    this.name = name;
    this.script = resolveScriptUrl(script);
  }

  async load(suffix = ""): Promise<void> {
    try {
      const mod = await import(`${this.script}${suffix}`);
      await emit(this.#denops, `DenopsSystemPluginPre:${this.name}`);
      await mod.main(this.#denops);
      await emit(this.#denops, `DenopsSystemPluginPost:${this.name}`);
    } catch (e) {
      console.error(e);
      await emit(this.#denops, `DenopsSystemPluginFail:${this.name}`);
    }
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#denops.dispatcher[fn](...args);
  }
}

async function emit(denops: Denops, name: string): Promise<void> {
  try {
    await denops.cmd(`doautocmd <nomodeline> User ${name}`);
  } catch (e) {
    console.warn(`Failed to emit ${name}: ${e}`);
  }
}

function resolveScriptUrl(script: string): string {
  try {
    return toFileUrl(script).href;
  } catch {
    return new URL(script, import.meta.url).href;
  }
}
