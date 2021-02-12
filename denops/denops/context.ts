export interface Context {
  mode: "vim" | "neovim";
  debug: boolean;
}

export const context: Context = {
  mode: "neovim",
  debug: false,
};
