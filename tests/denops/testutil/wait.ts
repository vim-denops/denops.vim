import { AssertionError } from "@std/assert/assertion-error";
import { abortable } from "@std/async/abortable";
import { delay } from "@std/async/delay";
import { getConfig } from "./conf.ts";

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_INTERVAL = 50;

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
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = DEFAULT_INTERVAL,
    message,
  } = { ...getConfig(), ...options };
  const signal = AbortSignal.timeout(timeout);

  const waitTruthy = async () => {
    for (;;) {
      const res = await fn();
      if (res) {
        return res;
      }
      await delay(interval, { signal });
    }
  };

  try {
    return await abortable(waitTruthy(), signal);
  } catch (e) {
    if (e === signal.reason) {
      const suffix = message ? `: ${message}` : ".";
      throw new AssertionError(`Timeout in ${timeout} millisec${suffix}`);
    }
    throw e;
  }
}
