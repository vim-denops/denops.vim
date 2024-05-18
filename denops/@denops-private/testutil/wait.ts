export type WaitOptions = {
  /**
   * Timeout period to an exception is thrown.
   * @default {10_000}
   */
  timeout?: number;
  /**
   * Polling interval.
   * @default {50}
   */
  interval?: number;
};

/**
 * Calls `fn` periodically and returns the result if it is TRUE.
 * An exception is thrown when the timeout expires.
 */
export function wait(
  fn: () => unknown | Promise<unknown>,
  options?: WaitOptions,
): Promise<unknown> {
  const { timeout = 10_000, interval = 50 } = options ?? {};
  return new Promise((resolve, reject) => {
    let i: number | undefined;
    const t = setTimeout(() => {
      clearTimeout(i);
      reject(new Error(`Timeout waitTrue in ${timeout} millisec`));
    }, timeout);
    const next = async () => {
      const res = await fn();
      if (res) {
        clearTimeout(t);
        resolve(res);
      } else {
        i = setTimeout(next, interval);
      }
    };
    next();
  });
}
