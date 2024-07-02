import { fromFileUrl } from "jsr:@std/path@0.225.0/from-file-url";
import { resolve } from "jsr:@std/path@0.225.0/resolve";
import { SEPARATOR as SEP } from "jsr:@std/path@0.225.0/constants";

let conf: Config | undefined;

export interface Config {
  denopsPath: string;
  vimExecutable: string;
  nvimExecutable: string;
  verbose: boolean;
  timeout?: number;
}

export function getConfig(): Config {
  if (conf) {
    return conf;
  }
  const denopsPath = Deno.env.get("DENOPS_TEST_DENOPS_PATH") ??
    fromFileUrl(new URL("../../..", import.meta.url));
  const verbose = Deno.env.get("DENOPS_TEST_VERBOSE");
  const timeout = Number.parseFloat(
    Deno.env.get("DENOPS_TEST_TIMEOUT") ?? "NaN",
  );
  conf = {
    denopsPath: removeTrailingSep(resolve(denopsPath)),
    vimExecutable: Deno.env.get("DENOPS_TEST_VIM_EXECUTABLE") ?? "vim",
    nvimExecutable: Deno.env.get("DENOPS_TEST_NVIM_EXECUTABLE") ?? "nvim",
    verbose: verbose === "1" || verbose === "true",
    timeout: timeout >= 0 ? timeout : undefined,
  };
  return conf;
}

// NOTE:
// `fromFileUrl()` returns a path like `C:\path\to\denops\` on Windows and It seems Vim could not handle
// `runtimepath` with a trailing backslash. So we need to remove it here.
function removeTrailingSep(path: string): string {
  const parts = path.split(SEP);
  if (parts.length <= 2 || parts.at(-1) !== "") {
    return path;
  }
  return parts.slice(0, -1).join(SEP);
}

export const _internal = {
  removeTrailingSep,
};
