<div align="center">
<img src="https://user-images.githubusercontent.com/3132889/113470275-51e30a00-948f-11eb-81bb-812986d131d5.png" width="300"><br>
<strong>Denops</strong><br>
<sup>An ecosystem of Vim/Neovim which allows developers to write plugins in Deno.</sup>

[![Deno 1.32 or above](https://img.shields.io/badge/Deno-Support%201.32.0-yellowgreen.svg?logo=deno)](https://github.com/denoland/deno/tree/v1.32.0)
[![Vim 9.0.2189 or above](https://img.shields.io/badge/Vim-Support%209.0.2189-yellowgreen.svg?logo=vim)](https://github.com/vim/vim/tree/v9.0.2189)
[![Neovim 0.9.4 or above](https://img.shields.io/badge/Neovim-Support%200.9.4-yellowgreen.svg?logo=neovim&logoColor=white)](https://github.com/neovim/neovim/tree/v0.9.4)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![deno land](http://img.shields.io/badge/available%20on-deno.land/x/denops__core-lightgrey.svg?logo=deno)](https://deno.land/x/denops_core)
[![test](https://github.com/vim-denops/denops.vim/actions/workflows/test.yml/badge.svg)](https://github.com/vim-denops/denops.vim/actions/workflows/test.yml)
[![codecov](https://codecov.io/github/vim-denops/denops.vim/branch/main/graph/badge.svg?token=k50SaoYUp0)](https://codecov.io/github/vim-denops/denops.vim)

[![vim help](https://img.shields.io/badge/vim-%3Ah%20denops-orange.svg)](doc/denops.txt)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/denops_core/mod.ts)
[![Documentation](https://img.shields.io/badge/denops-Documentation-yellow.svg)](https://vim-denops.github.io/denops-documentation/)

</div>

## Quick start

First of all, install the latest [Deno][deno]. See
[Deno's official manual](https://deno.land/manual/getting_started/installation)
for details.

Note that `deno` command need to be executable from Vim/Neovim. You can confirm
it by `exepath()` function in Vim/Neovim like below:

```vim
:echo exepath('deno')
/usr/local/bin/deno
```

Or specify an absolute path to `g:denops#deno` variable (See
`:help g:denops#deno`.)

Once you got deno to work, install `vim-denops/denops.vim` as a general Vim
plugin. For example, the following uses [vim-plug][vim-plug]:

```vim
Plug 'vim-denops/denops.vim'
Plug 'vim-denops/denops-helloworld.vim'
```

Then you can confirm if denops is working properly by executing `DenopsHello`
command like:

```vim
:DenopsHello
Hello
```

Once you've confirmed that denops is working, you can remove
`vim-denops/denops-helloworld.vim`.

[deno]: https://deno.land/
[vim-plug]: https://github.com/junegunn/vim-plug

### Shared server

Normally, a Denops server is started for each Vim/Neovim instance, but there are
cases where the process startup becomes a bottleneck and impairs usability.

In such cases, launching a "Shared server" and connecting to it will allow all
Vim/Neovim instances to use a shared server, thus avoiding the bottleneck of
process launches and possibly improving usability.

To start the shared server, execute the following command in the denops.vim
repository top

```
deno run -A --no-lock ./denops/@denops-private/cli.ts
```

Then specify the server address in `g:denops_server_addr` as follows

```vim
let g:denops_server_addr = '127.0.0.1:32123'
```

If you'd like to specify hostname and port, use `--hostname` and `--port`
command arguments as follows

```
deno run -A --no-lock \
    ./denops/@denops-private/cli.ts \
    --hostname=0.0.0.0 \
    --port 12345
```

## Documentations

To learn how to write Vim/Neovim plugins by denops, see
[Denops Documentation](https://vim-denops.github.io/denops-documentation/) or
[denops.vim Wiki](https://github.com/vim-denops/denops.vim/wiki).

## Support policy

Denops determines the supported versions of Vim/Neovim/Deno based on the
following support policy when updating the major version:

- For Vim, versions older than the latest version provided by
  [Homebrew][homebrew] and the version distributed by
  [vim-win32-installer][vim-win32-installer]
  - Windows users can install it by downloading the package from
    [vim-win32-installer][vim-win32-installer]
  - macOS users can install it through [Homebrew][homebrew]
  - Linux users have the flexibility to build any version they prefer
- For Neovim/Deno, the two most recent minor versions
  - Both Neovim and Deno adhere to
    [semantic versioning](https://semver.org/spec/v2.0.0.html) principles

[homebrew]: https://brew.sh/
[vim-win32-installer]: https://github.com/vim/vim-win32-installer

## Versioning

Before v1.10.0, we defined that the version of denops.vim indicates that code
versions of the entire repository. However, we changed this assumption from
version v1.10.0. Now we defined the version of denops.vim indicates the version
of the code in the `denops/@denops` directory that is published to deno.land as
`denops_core`. That's why we won't bump versions when there are no changes on
code in that directory.

## Developers

Denops is mainly developed by members of [vim-jp][vim-jp].

## Inspired by

This ecosystem is strongly inspired by [coc.nvim][coc.nvim] which allows
developers to write Vim/Neovim plugin in [Node.js][node.js].

[coc.nvim]: https://github.com/neoclide/coc.nvim
[node.js]: https://nodejs.org/ja/
[vim-jp]: https://vim-jp.org/

## License

The code follows MIT license written in [LICENSE](./LICENSE). Contributors need
to agree that any modifications sent in this repository follow the license.
