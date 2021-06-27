<div align="center">
<img src="https://user-images.githubusercontent.com/3132889/113470275-51e30a00-948f-11eb-81bb-812986d131d5.png" width="300"><br>
<strong>Denops</strong><br>
<sup>An ecosystem of Vim/Neovim which allows developers to write plugins in Deno.</sup>

![Deno 1.11.0 or above](https://img.shields.io/badge/Deno-Support%201.11.0-yellowgreen.svg?logo=deno)
![Vim 8.1.2424 or above](https://img.shields.io/badge/Vim-Support%208.1.2424-yellowgreen.svg?logo=vim)
![Neovim 0.4.4 or above](https://img.shields.io/badge/Neovim-Support%200.4.4-yellowgreen.svg?logo=neovim&logoColor=white)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Doc](https://img.shields.io/badge/doc-%3Ah%20denops-orange.svg)](doc/denops.txt)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/denops_core/mod.ts)
[![deno land](http://img.shields.io/badge/available%20on-deno.land/x-lightgrey.svg?logo=deno)](https://deno.land/x/denops_core)

[![deno](https://github.com/vim-denops/denops.vim/workflows/deno/badge.svg)](https://github.com/vim-denops/denops.vim/actions?query=workflow%3Adeno)
[![vim](https://github.com/vim-denops/denops.vim/workflows/vim/badge.svg)](https://github.com/vim-denops/denops.vim/actions?query=workflow%3Avim)
[![neovim](https://github.com/vim-denops/denops.vim/workflows/neovim/badge.svg)](https://github.com/vim-denops/denops.vim/actions?query=workflow%3Aneovim)
[![reviewdog](https://github.com/vim-denops/denops.vim/workflows/reviewdog/badge.svg)](https://github.com/vim-denops/denops.vim/actions?query=workflow%3Areviewdog)

</div>

<div align="center">
<strong>WARNING</strong><br>
Denops is under active development. Any kind of breaking changes may be applied without any announcements.

</div>

## Quick start

Install the latest [Deno][deno] with:

##### macOS or Linux

```
curl -fsSL https://deno.land/x/install/install.sh | sh
```

##### Windows

```
iwr https://deno.land/x/install/install.ps1 -useb | iex
```

##### Others

See [Deno Manual](https://deno.land/manual/getting_started/installation).

Note that `deno` need to be executable from Vim/Neovim. You can confirm it by
execute the following command in Vim/Neovim.

```vim
:echo executable('deno')
1
```

Once you got deno to work, install denops.vim via [vim-plug][vim-plug] like:

```vim
Plug 'vim-denops/denops.vim'
Plug 'vim-denops/denops-helloworld.vim'
```

Then you can confirm if denops is working by executing `HelloDenops` command
like:

```vim
:HelloDenops
Your name: John
Hello Denops. Your name is John. This is nvim
```

Once you've confirmed that denops is working, you can remove
`vim-denops/denops-helloworld.vim`.

[deno]: https://deno.land/
[vim-plug]: https://github.com/junegunn/vim-plug

## Documentations

See [denops.vim Wiki](https://github.com/vim-denops/denops.vim/wiki).

## Developpers

Denops is mainly developped by members of [vim-jp][vim-jp].

## Inspired by

This ecosystem is strongly inspired by [coc.nvim][coc.nvim] which allows
developers to write Vim/Neovim plugin in [Node.js][node.js].

[coc.nvim]: https://github.com/neoclide/coc.nvim
[node.js]: https://nodejs.org/ja/
[vim-jp]: https://vim-jp.org/

## License

The code follows MIT license written in [LICENSE](./LICENSE). Contributors need
to agree that any modifications sent in this repository follow the license.
