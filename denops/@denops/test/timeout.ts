import { deferred } from "../deps_test.ts";

export class TimeoutError extends Error {
  constructor() {
    super("Timeout");
    this.name = "TimeoutError";
  }
}

export function timeout<T>(p: Promise<T>, delay: number): Promise<T> {
  const d = deferred<never>();
  const t = setTimeout(() => d.reject(new TimeoutError()), delay);
  p.finally(() => clearTimeout(t));
  return Promise.race([p, d]);
}
