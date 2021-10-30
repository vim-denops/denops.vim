import { Context, Denops, Dispatcher, Meta } from "./types.ts";

export function normArgs(args: unknown[]): unknown[] {
  const normArgs = [];
  for (const arg of args) {
    if (arg === undefined) {
      break;
    }
    normArgs.push(arg);
  }
  return normArgs;
}

export abstract class AbstractDenops implements Denops {
  abstract name: string;
  abstract meta: Meta;
  abstract dispatcher: Dispatcher;

  abstract call(fn: string, ...args: unknown[]): Promise<unknown>;
  abstract batch(...calls: [string, ...unknown[]][]): Promise<unknown[]>;

  async cmd(cmd: string, ctx: Context = {}): Promise<void> {
    await this.call("denops#api#cmd", cmd, ctx);
  }

  async eval(expr: string, ctx: Context = {}): Promise<unknown> {
    return await this.call("denops#api#eval", expr, ctx);
  }

  abstract dispatch(
    name: string,
    fn: string,
    ...args: unknown[]
  ): Promise<unknown>;
}
