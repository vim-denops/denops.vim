import { encode as base64Encode } from "https://deno.land/std@0.111.0/encoding/base64.ts";

export async function bulkImport<T>(
  pathset: string[],
): Promise<Record<string, T>> {
  const imports = pathset.map((path, i) =>
    `import * as mod${i} from ${JSON.stringify(path)};`
  );
  const bodies = pathset.map((path, i) => {
    return `  ${JSON.stringify(path)}: mod${i},`;
  });
  const content = [
    ...imports,
    "export const mods = {",
    ...bodies,
    "};",
  ];
  const base64Content = base64Encode(content.join("\n"));
  const { mods } = await import(`data:charset=utf-8;base64,${base64Content}`);
  return mods;
}
