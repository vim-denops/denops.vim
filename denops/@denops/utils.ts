/**
 * Ensure if the value is string by raising an error when it's not.
 *
 * @param x: A value to be examined.
 * @param name: An attribute name for error message.
 */
export function ensureString(
  x: unknown,
  name = "value",
): asserts x is string {
  if (typeof x !== "string") {
    throw new Error(`The ${name} must be a string`);
  }
}

/**
 * Ensure if the value is number by raising an error when it's not.
 *
 * @param x: A value to be examined.
 * @param name: An attribute name for error message.
 */
export function ensureNumber(
  x: unknown,
  name = "value",
): asserts x is number {
  if (typeof x !== "number") {
    throw new Error(`The ${name} must be a number`);
  }
}

/**
 * Ensure if the value is array by raising an error when it's not.
 *
 * @param x: A value to be examined.
 * @param name: An attribute name for error message.
 */
export function ensureArray(
  x: unknown,
  name = "value",
): asserts x is unknown[] {
  if (!Array.isArray(x)) {
    throw new Error(`The ${name} must be an array`);
  }
}

/**
 * Ensure if the record (object) is array by raising an error when it's not.
 *
 * @param x: A value to be examined.
 * @param name: An attribute name for error message.
 */
export function ensureRecord(
  x: unknown,
  name = "value",
): asserts x is Record<string, unknown> {
  const t = typeof x;
  if (t !== "object" || x == null || Array.isArray(x)) {
    throw new Error(`The ${name} must be an record object`);
  }
}
