import type { Service } from "../../service.ts";
import type { Plugin } from "../base.ts";
import type { Denops, Dispatcher } from "../../../@denops/mod.ts";
import { DenopsImpl } from "./denops.ts";

export class NaivePlugin implements Plugin {
  #denops: DenopsImpl;

  readonly name: string;
  readonly script: string;

  dispatcher: Dispatcher = {};

  constructor(name: string, script: string, service: Service) {
    this.name = name;
    this.script = script;
    this.#denops = new DenopsImpl(name, service);
    const suffix = `#${performance.now()}`;
    import(`${script}${suffix}`).then(async (mod) => {
      try {
        await emit(this.#denops, `DenopsSystemPluginPre:${name}`);
        await mod.main(this.#denops);
        await emit(this.#denops, `DenopsSystemPluginPost:${name}`);
      } catch (e) {
        console.error(e);
        await emit(this.#denops, `DenopsSystemPluginFail:${name}`);
      }
    });
  }

  async call(fn: string, ...args: unknown[]): Promise<unknown> {
    return await this.#denops.dispatcher[fn](...args);
  }

  dispose(): void {
    // Do nothing
  }
}

function emit(denops: Denops, name: string): Promise<void> {
  return denops.cmd(`doautocmd <nomodeline> User ${name}`)
    .catch((e) => console.warn(`Failed to emit ${name}: ${e}`));
}
