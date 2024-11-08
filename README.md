<div align="center">
<img src="https://user-images.githubusercontent.com/3132889/113470275-51e30a00-948f-11eb-81bb-812986d131d5.png" width="300"><br>
<strong>Denops</strong><br>
<sup>An ecosystem for Vim/Neovim enabling developers to write plugins in Deno.</sup>

[![Deno 1.45.0 or above](https://img.shields.io/badge/Deno-Support%201.45.0-yellowgreen.svg?logo=deno)](https://github.com/denoland/deno/tree/v1.45.0)
[![Vim 9.1.0448 or above](https://img.shields.io/badge/Vim-Support%209.1.0448-yellowgreen.svg?logo=vim)](https://github.com/vim/vim/tree/v9.1.0448)
[![Neovim 0.10.0 or above](https://img.shields.io/badge/Neovim-Support%200.10.0-yellowgreen.svg?logo=neovim&logoColor=white)](https://github.com/neovim/neovim/tree/v0.10.0)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![test](https://github.com/vim-denops/denops.vim/actions/workflows/test.yml/badge.svg)](https://github.com/vim-denops/denops.vim/actions/workflows/test.yml)
[![codecov](https://codecov.io/github/vim-denops/denops.vim/branch/main/graph/badge.svg?token=k50SaoYUp0)](https://codecov.io/github/vim-denops/denops.vim)

[![vim help](https://img.shields.io/badge/vim-%3Ah%20denops-orange.svg)](doc/denops.txt)
[![Documentation](https://img.shields.io/badge/denops-Documentation-yellow.svg)](https://vim-denops.github.io/denops-documentation/)

</div>

[Denops] ([/ˈdiːnoʊps/](http://ipa-reader.xyz/?text=%CB%88di%CB%90no%CA%8Aps),
pronounced `dee-nops`) is an ecosystem for [Vim] / [Neovim] that allows
developers to write plugins in [TypeScript] / [JavaScript] powered by [Deno].

[Denops]: https://github.com/vim-denops/denops.vim
[Vim]: https://www.vim.org/
[Neovim]: https://neovim.io/
[TypeScript]: https://www.typescriptlang.org/
[JavaScript]: https://developer.mozilla.org/en-US/docs/Web/JavaScript
[Deno]: https://deno.land/

## For users

Firstly, install the latest [Deno]. Refer to the
[Deno official manual](https://docs.deno.com/runtime/getting_started/installation/)
for details.

Ensure that the `deno` command is executable from Vim / Neovim (hereafter, when
we refer to "Vim" without restriction, we also include "Neovim"). You can
confirm this using the `exepath()` function in Vim, as shown below:

```vim
:echo exepath('deno')
/usr/local/bin/deno
```

Alternatively, specify the absolute path of the Deno executable to the
`g:denops#deno` variable, like so:

```vim
let g:denops#deno = '/usr/local/bin/deno'
```

Once Deno is set up, install `vim-denops/denops.vim` as a general Vim plugin.
For example, using [vim-plug]:

```vim
Plug 'vim-denops/denops.vim'
```

### Confirm if denops is working

To confirm if denops is working properly, also install
[vim-denops/denops-helloworld.vim](https://github.com/vim-denops/denops-helloworld.vim)
like this:

```vim
Plug 'vim-denops/denops-helloworld.vim'
```

Then, confirm if denops is working by executing the `DenopsHello` command:

```vim
:DenopsHello
Hello
```

Once you've confirmed that denops is working, you can remove
`vim-denops/denops-helloworld.vim`.

[vim-plug]: https://github.com/junegunn/vim-plug

### Shared server

You may encounter an issue where Denops plugins are slow to start up. This is
because Denops requires a Deno process to start before, and the process startup
can become a bottleneck, impairing usability.

In such cases, you can avoid this startup overhead by using a **Shared server**.
To use a shared server, add the following to your `.vimrc`:

```vim
let g:denops_server_addr = '127.0.0.1:32123'
```

Now, set up the shared server by using
[vim-denops/denops-shared-server.vim](https://github.com/vim-denops/denops-shared-server.vim).
First, install the plugin:

```vim
Plug 'vim-denops/denops-shared-server.vim'
```

Then, set up the shared server by executing `denops_shared_server#install()`:

```vim
:call denops_shared_server#install()
```

> [!NOTE]
>
> Alternatively, you can launch the shared server manually using the
> `denops/@denops-private/cli.ts` script:
>
> ```
> deno run -A --no-lock {path/to/denops.vim}/denops/@denops-private/cli.ts --hostname=127.0.0.1 --port=32123
> ```

Afterward, restart Vim, and you'll notice an improvement in the startup time of
Denops plugins.

### Windows users

If you are using Windows, you may still face an issue where Denops plugins are
slow to start up, even with the shared server. One possible reason is that the
antivirus software, like Windows Defender, is scanning Deno's cache directory
(`%LOACALAPPDATA%\deno`) every time Deno starts up. To avoid this, add Deno's
cache directory to the exclusion list of the antivirus software.

Refer to and follow
[Add an exclusion to Windows Security](https://support.microsoft.com/en-us/windows/add-an-exclusion-to-windows-security-811816c0-4dfd-af4a-47e4-c301afe13b26)
or your antivirus software manual to exclude Deno's cache directory from virus
scans, with your own responsibility.

### Support Policy

Denops determines the supported versions of Vim/Neovim/Deno based on the
following support policy when updating the major version:

- For Vim, versions older than the latest version provided by [Homebrew] and the
  version distributed by [vim-win32-installer]
  - Windows users can install it by downloading the package from
    [vim-win32-installer]
  - macOS users can install it through [Homebrew]
  - Linux users have the flexibility to build any version they prefer
- Regarding Neovim/Deno, support extends to the two most recent minor versions.
  - Both Neovim and Deno adhere to
    [semantic versioning](https://semver.org/spec/v2.0.0.html) principles.
  - Since Neovim is still in the 0.x version range, we assume that the 0.x.y
    version is considered part of the 0.x version, ensuring support for the
    latest available versions.

[Homebrew]: https://brew.sh/
[vim-win32-installer]: https://github.com/vim/vim-win32-installer

## For plugin developers

To learn how to write Denops plugins, refer to the
[Denops Documentation](https://vim-denops.github.io/denops-documentation/) or
read the code of the following Denops plugins:

- [vim-denops/denops-helloworld.vim](https://github.com/vim-denops/denops-helloworld.vim)
- [lambdalisue/gin.vim](https://github.com/lambdalisue/gin.vim)
- [vim-skk/skkeleton](https://github.com/vim-skk/skkeleton)
- [Shougo/ddu.vim](https://github.com/Shougo/ddu.vim)
- [Find one from the `vim-denops` topic](https://github.com/topics/vim-denops)

Alternatively, join the
[Slack workspace for vim-jp](https://join.slack.com/t/vim-jp/shared_invite/zt-zcifn2id-e6EsDjIKEzx~UlF~hE2Njg)
and ask questions in the
[`#tech-denops`](https://vim-jp.slack.com/archives/C01N4L5362D) channel. Most of
the conversations are in Japanese, but most of us understand English, and you
can ask questions in English.

### YouTube

[![Revolutionizing Vim/Neovim Plugin Development ~ An In-Depth Look into Denops](http://img.youtube.com/vi/hu9EN7jl2kA/0.jpg)](https://www.youtube.com/watch?v=hu9EN7jl2kA)<br>
[English slide](https://bit.ly/4eQ8LH5) in a talk at
[VimConf 2023 Tiny](https://vimconf.org/2023/) (with Japanese)

## Misc.

### Developers

Denops is mainly developed by members of [vim-jp].

### Inspired by

This ecosystem is strongly inspired by [coc.nvim], which allows developers to
write Vim/Neovim plugins in [Node.js]. We express our great respect and
gratitude to the coc.nvim developers.

[coc.nvim]: https://github.com/neoclide/coc.nvim
[Node.js]: https://nodejs.org/ja/
[vim-jp]: https://vim-jp.org/

## License

The code follows the MIT license, as stated in [LICENSE](./LICENSE).
Contributors need to agree that any modifications sent to this repository follow
the license.
