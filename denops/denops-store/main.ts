import type { Denops } from "./deps.ts";

const store = new Map();

export function main(denops: Denops): void {
  denops.dispatcher = {
    get(key: unknown) {
      return Promise.resolve(store.get(key));
    },

    set(key: unknown, value: unknown) {
      store.set(key, value);
      return Promise.resolve();
    },

    delete(key: unknown) {
      return Promise.resolve(store.delete(key));
    },
  };
}
