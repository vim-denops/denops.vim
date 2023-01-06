const marker = Symbol("patchConsole");

type PatchedConsole = Console & { [marker]?: boolean };

/**
 * Patch several methods of `console` to globally add `prefix`
 */
export function patchConsole(
  prefix: string,
  console: PatchedConsole = globalThis.console,
): void {
  if (console[marker]) {
    return;
  }
  // Patch simple methods
  const simpleTargets = [
    "debug",
    "dirxml",
    "error",
    "group",
    "groupCollapsed",
    "info",
    "log",
    "trace",
    "warn",
  ] as const;
  for (const target of simpleTargets) {
    const ori = console[target];
    console[target] = (...data) => {
      ori.apply(console, [`${prefix}`, ...data]);
    };
  }
  // Patch complex methods
  const assertOri = console.assert;
  console.assert = (condition, ...data) => {
    assertOri.apply(console, [condition, `${prefix}`, ...data]);
  };
  const timeLogOri = console.timeLog;
  console.timeLog = (label, ...data) => {
    timeLogOri.apply(console, [label, `${prefix}`, ...data]);
  };
}
