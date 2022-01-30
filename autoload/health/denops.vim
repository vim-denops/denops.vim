let s:deno_version = '1.17.1'
let s:vim_version = '8.2.3452'
let s:neovim_version = '0.6.0'

function! s:compare_version(v1, v2) abort
  let v1 = map(split(a:v1, '\.'), { _, v -> v + 0 })
  let v2 = map(split(a:v2, '\.'), { _, v -> v + 0 })
  for i in range(max([len(v1), len(v2)]))
    let t1 = get(v1, i, 0)
    let t2 = get(v2, i, 0)
    if t1 isnot# t2
      return t1 > t2 ? 1 : -1
    endif
  endfor
  return 0
endfunction

function! s:get_deno_version(deno) abort
  let output = system(printf('%s --version', a:deno))
  return matchstr(output, 'deno \zs[0-9.]\+')
endfunction

function! s:check_deno_executable() abort
  call health#report_info(printf(
        \ 'Deno executable: `%s` (g:denops#deno)',
        \ g:denops#deno,
        \))
  if !executable(g:denops#deno)
    call health#report_error(printf(
          \ 'It seems `%s` is not executable. Please install deno and add to `$PATH`.',
          \ g:denops#deno,
          \))

    if g:denops#deno !=# 'deno' && executable('deno')
      call health#report_info(printf(
            \ 'It seems `deno` is executable but `%s` is specified to g:denops#deno by user.',
            \ g:denops#deno,
            \))
    endif
    return
  endif
  call health#report_ok('Deno executable check: passed')
endfunction

function! s:check_deno_version() abort
  let deno_version = s:get_deno_version(g:denops#deno)
  call health#report_info(printf(
        \ 'Supported Deno version: `%s`',
        \ s:deno_version,
        \))
  call health#report_info(printf(
        \ 'Detected Deno version: `%s`',
        \ deno_version,
        \))
  if empty(deno_version)
    call health#report_error('Unable to detect version of deno, make sure your deno runtime is correct.')
    return
  elseif s:compare_version(deno_version, s:deno_version) < 0
    call health#report_error(printf(
          \ 'Unsupported Deno version is detected. You need to upgrade it to `%s` or later.',
          \ s:deno_version,
          \))
    return
  endif
  call health#report_ok('Deno version check: passed')
endfunction

function! s:check_vim_version() abort
  call health#report_info(printf(
        \ 'Supported Vim version: `%s`',
        \ s:vim_version,
        \))
  call health#report_info(printf(
        \ 'Detected Vim version: `%s`',
        \ denops#util#meta().version,
        \))
  if !has(printf('patch-%s', s:vim_version))
    call health#report_error(printf(
          \ 'Unsupported Vim version is detected. You need to upgrade it to `%s` or later.',
          \ s:vim_version,
          \))
    return
  endif
  call health#report_ok('Vim version check: passed')
endfunction

function! s:check_neovim_version() abort
  call health#report_info(printf(
        \ 'Supported Neovim version: `%s`',
        \ s:neovim_version,
        \))
  call health#report_info(printf(
        \ 'Detected Neovim version: `%s`',
        \ denops#util#meta().version,
        \))
  if !has(printf('nvim-%s', s:neovim_version))
    call health#report_error(printf(
          \ 'Unsupported Neovim version is detected. You need to upgrade it to `%s` or later.',
          \ s:neovim_version,
          \))
    return
  endif
  call health#report_ok('Neovim version check: passed')
endfunction

function! s:check_denops() abort
  if get(g:, 'denops#debug', 0)
    call health#report_warn('Denops is running with debug mode (g:denops#debug)')
  endif
endfunction

function! s:check_denops_status() abort
  let server_status = denops#server#status()
  call health#report_info(printf(
        \ 'Denops status: `%s`',
        \ server_status,
        \))
  if server_status ==# 'stopped'
    call health#report_error('Denops is stopped. Execute `:message` command to find reasons.')
    return
  endif
  call health#report_ok('Denops status check: passed')
endfunction

function! health#denops#check() abort
  call s:check_deno_version()
  if !has('nvim')
    call s:check_vim_version()
  else
    call s:check_neovim_version()
  endif
  call s:check_denops()
  call s:check_denops_status()
endfunction
