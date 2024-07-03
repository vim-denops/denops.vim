export const ADDR_ENV_NAME = "DENOPS_TEST_ADDRESS";

async function main(): Promise<void> {
  const addr = Deno.env.get(ADDR_ENV_NAME);
  if (!addr) {
    throw new Error(`Environment variable '${ADDR_ENV_NAME}' is required`);
  }
  const conn = await Deno.connect(JSON.parse(addr));
  await Promise.race([
    Deno.stdin.readable.pipeTo(conn.writable),
    conn.readable.pipeTo(Deno.stdout.writable),
  ]);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    console.error(e);
    Deno.exit(1);
  }
}
