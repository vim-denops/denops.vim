import { AssertionError } from "jsr:@std/assert@^0.225.1/assertion-error";

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
  /** Message for timeout error. */
  message?: string;
};

/**
 * Calls `fn` periodically and returns the result if it is TRUE.
 * An exception is thrown when the timeout expires.
 */
export async function wait<T>(
  fn: () => T | Promise<T>,
  options?: WaitOptions,
): Promise<T> {
  const { timeout = 10_000, interval = 50, message } = options ?? {};
  const TIMEOUT = {};

  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(TIMEOUT), timeout);
  });

  let intervalId: number | undefined;
  const delay = () =>
    new Promise<void>((resolve) => {
      intervalId = setTimeout(resolve, interval);
    });

  try {
    return await Promise.race([
      (async () => {
        for (;;) {
          const res = await fn();
          if (res) {
            return res;
          }
          await delay();
        }
      })(),
      timeoutPromise,
    ]);
  } catch (e) {
    if (e === TIMEOUT) {
      const suffix = message ? `: ${message}` : ".";
      throw new AssertionError(`Timeout in ${timeout} millisec${suffix}`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
    clearTimeout(intervalId);
  }
}
