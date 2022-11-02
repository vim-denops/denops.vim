import { deadline } from "https://deno.land/std@0.149.0/async/mod.ts";
import { parse } from "https://deno.land/std@0.149.0/flags/mod.ts";
import { using } from "https://deno.land/x/disposable@v1.0.2/mod.ts#^";
import { Service } from "./service.ts";
import { HostContainer } from "./host/host_container.ts";
import { Vim } from "./host/vim.ts";
import { Neovim } from "./host/nvim.ts";
import { TraceReader, TraceWriter } from "./tracer.ts";
import { tee } from "./tee.ts";

type Opts = {
  hostname?: string;
  port?: number;
  trace?: boolean;
  quiet?: boolean;
  identity?: boolean;
};

type Host = typeof Vim | typeof Neovim;

async function detectHost(reader: Deno.Reader): Promise<Host> {
  const marks = new TextEncoder().encode('[{tf"0123456789');
  const chunk = new Uint8Array(1);
  await reader.read(chunk);
  const mark = chunk.at(0);
  if (mark && marks.includes(mark)) {
    return Vim;
  }
  return Neovim;
}

/**
 * Register signals for graceful termination
 */
function registerSignals(
  listener: Deno.Listener,
  hosts: HostContainer,
) {
  const signals: ReadonlyArray<readonly [Deno.Signal, number]> = [
    ["SIGINT", 2],
    ...(
      Deno.build.os === "windows"
        ? [
          // SIGBREAK was added from Deno version 1.23
          ["SIGBREAK" as Deno.Signal, 21],
        ] as const
        : [
          ["SIGTERM", 15],
        ] as const
    ),
  ];

  const terminate_timeout = 2000;

  const unregister = signals.map(([sigid, signum]) => {
    const handler = () => signalHandler(signum);
    try {
      Deno.addSignalListener(sigid, handler);
    } catch (_) {
      return () => {}; // not implemented, so do nothing
    }
    return () => Deno.removeSignalListener(sigid, handler);
  });

  function signalHandler(signum: number) {
    if (!quiet) {
      console.error(`Terminate by signal ${signum}`);
    }

    // Unregister all signals, so a second signal kills the server immediately
    unregister.forEach((u) => u());

    // Disable new connection
    listener.close();

    const reason = 128 + signum;
    deadline(hosts.terminate(reason), terminate_timeout).finally(() =>
      Deno.exit(reason)
    );
  }
}

const { hostname, port, trace, quiet, identity } = parse(Deno.args) as Opts;

const listener = Deno.listen({
  hostname: hostname ?? "127.0.0.1",
  port: port ?? 32123,
});
const localAddr = listener.addr as Deno.NetAddr;

if (identity) {
  console.log(`${localAddr.hostname}:${localAddr.port}`);
}
if (!quiet) {
  console.log(
    `Listen denops clients on ${localAddr.hostname}:${localAddr.port}`,
  );
}

const hosts = new HostContainer();

registerSignals(listener, hosts);

for await (const conn of listener) {
  const remoteAddr = conn.remoteAddr as Deno.NetAddr;
  const reader = trace ? new TraceReader(conn) : conn;
  const writer = trace ? new TraceWriter(conn) : conn;

  const [r1, r2] = tee(reader);

  // Detect host from payload
  const hostClass = await detectHost(r1);
  r1.close();

  if (!quiet) {
    console.log(
      `${remoteAddr.hostname}:${remoteAddr.port} (${hostClass.name}) is connected`,
    );
  }

  // Create host and service
  using(new hostClass(r2, writer), async (host) => {
    hosts.add(host);
    try {
      await using(new Service(host), async (service) => {
        await service.waitClosed();
      });
    } finally {
      hosts.delete(host);
      if (!quiet) {
        console.log(
          `${remoteAddr.hostname}:${remoteAddr.port} (${hostClass.name}) is closed`,
        );
      }
    }
  });
}
