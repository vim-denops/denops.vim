import supportedVersions from "../denops/supported_versions.json" with {
  type: "json",
};

async function main(): Promise<void> {
  await updateREADME();
  await updatePluginDenops();
  await updateGithubWorkflowsTest();
}

async function updateREADME(): Promise<void> {
  const url = new URL(import.meta.resolve("../README.md"));
  let text = await Deno.readTextFile(url);
  // Deno
  text = text.replace(
    /Deno\s+\d+\.\d+\.\d+/,
    `Deno ${supportedVersions.deno}`,
  );
  text = text.replace(
    /Deno-Support%20\d+\.\d+\.\d+/,
    `Deno-Support%20${supportedVersions.deno}`,
  );
  text = text.replace(
    /https:\/\/github\.com\/denoland\/deno\/tree\/v\d+\.\d+\.\d+/,
    `https://github.com/denoland/deno/tree/v${supportedVersions.deno}`,
  );
  // Vim
  text = text.replace(
    /Vim\s+\d+\.\d+\.\d+/,
    `Vim ${supportedVersions.vim}`,
  );
  text = text.replace(
    /Vim-Support%20\d+\.\d+\.\d+/,
    `Vim-Support%20${supportedVersions.vim}`,
  );
  text = text.replace(
    /https:\/\/github\.com\/vim\/vim\/tree\/v\d+\.\d+\.\d+/,
    `https://github.com/vim/vim/tree/v${supportedVersions.vim}`,
  );
  // Neovim
  text = text.replace(
    /Neovim\s+\d+\.\d+\.\d+/,
    `Neovim ${supportedVersions.neovim}`,
  );
  text = text.replace(
    /Neovim-Support%20\d+\.\d+\.\d+/,
    `Neovim-Support%20${supportedVersions.neovim}`,
  );
  text = text.replace(
    /https:\/\/github\.com\/neovim\/neovim\/tree\/v\d+\.\d+\.\d+/,
    `https://github.com/neovim/neovim/tree/v${supportedVersions.neovim}`,
  );
  await Deno.writeTextFile(url, text);
}

async function updatePluginDenops(): Promise<void> {
  const url = new URL(import.meta.resolve("../plugin/denops.vim"));
  let text = await Deno.readTextFile(url);
  // Vim
  text = text.replace(/patch-\d+\.\d+\.\d+/, `patch-${supportedVersions.vim}`);
  text = text.replace(
    /Vim\s+\d+\.\d+\.\d+/,
    `Vim ${supportedVersions.vim}`,
  );
  // Neovim
  text = text.replace(/nvim-\d+\.\d+\.\d+/, `nvim-${supportedVersions.neovim}`);
  text = text.replace(
    /Neovim\s+\d+\.\d+\.\d+/,
    `Neovim ${supportedVersions.neovim}`,
  );
  await Deno.writeTextFile(url, text);
}

async function updateGithubWorkflowsTest(): Promise<void> {
  const url = new URL(import.meta.resolve("../.github/workflows/test.yml"));
  let text = await Deno.readTextFile(url);
  // Deno
  text = text.replace(
    /deno_version:(.*?)"\d+\.\d+\.\d+"/s,
    `deno_version:$1"${supportedVersions.deno}"`,
  );
  // Vim
  text = text.replace(
    /vim:(.*?)"v\d+\.\d+\.\d+"/s,
    `vim:$1"v${supportedVersions.vim}"`,
  );
  // Neovim
  text = text.replace(
    /nvim:(.*?)"v\d+\.\d+\.\d+"/s,
    `nvim:$1"v${supportedVersions.neovim}"`,
  );
  await Deno.writeTextFile(url, text);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    Deno.exit(1);
  }
}
