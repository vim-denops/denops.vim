/**
 * Global context interface
 */
export interface Context {
  mode: "vim" | "neovim";
  debug: boolean;
}

/**
 * Global context
 */
export const context: Context = {
  mode: "neovim",
  debug: false,
};

/**
 * Update global context and return it
 */
export function updateContext(ctx: Partial<Context>): Context {
  return Object.assign(
    context,
    Object.fromEntries(Object.entries(ctx).filter(([_, v]) => v)),
  );
}
