import {
  Session,
  createTransporter,
} from "https://deno.land/x/msgpack_rpc@v2.0/mod.ts";

const client = new Session(createTransporter(Deno.stdin, Deno.stdout), {
  command(expr: unknown): Promise<unknown> {
    return this.call("nvim_command", expr);
  },
  eval(expr: unknown): Promise<unknown> {
    return this.call("nvim_eval", expr);
  },
  call(fn: unknown, ...args: unknown[]): Promise<unknown> {
    return this.call("nvim_call_function", fn, args);
  },
});
await client.listen();
