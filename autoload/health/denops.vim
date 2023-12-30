const s:DENO_VERSION = '1.32.0'
const s:VIM_VERSION = '9.0.1499'
const s:NEOVIM_VERSION = '0.8.0'

function! s:compare_version(v1, v2) abort
  let l:v1 = map(split(a:v1, '\.'), { _, v -> v + 0 })
  let l:v2 = map(split(a:v2, '\.'), { _, v -> v + 0 })
  for l:i in range(max([len(l:v1), len(l:v2)]))
    let l:t1 = get(l:v1, l:i, 0)
    let l:t2 = get(l:v2, l:i, 0)
    if l:t1 isnot# l:t2
      return l:t1 > l:t2 ? 1 : -1
    endif
  endfor
  return 0
endfunction

function! s:get_deno_version(deno) abort
  let l:output = system(printf('%s --version', a:deno))
  return matchstr(l:output, 'deno \zs[0-9.]\+')
endfunction

function! s:check_deno_executable() abort
  call s:report_info(printf(
        \ 'Deno executable: `%s` (g:denops#deno)',
        \ g:denops#deno,
        \))
  if !executable(g:denops#deno)
    call s:report_error(printf(
          \ 'It seems `%s` is not executable. Please install deno and add to `$PATH`.',
          \ g:denops#deno,
          \))

    if g:denops#deno !=# 'deno' && executable('deno')
      call s:report_info(printf(
            \ 'It seems `deno` is executable but `%s` is specified to g:denops#deno by user.',
            \ g:denops#deno,
            \))
    endif
    return
  endif
  call s:report_ok('Deno executable check: passed')
endfunction

function! s:check_deno_version() abort
  let l:deno_version = s:get_deno_version(g:denops#deno)
  call s:report_info(printf(
        \ 'Supported Deno version: `%s`',
        \ s:DENO_VERSION,
        \))
  call s:report_info(printf(
        \ 'Detected Deno version: `%s`',
        \ l:deno_version,
        \))
  if empty(l:deno_version)
    call s:report_error('Unable to detect version of deno, make sure your deno runtime is correct.')
    return
  elseif s:compare_version(l:deno_version, s:DENO_VERSION) < 0
    call s:report_error(printf(
          \ 'Unsupported Deno version is detected. You need to upgrade it to `%s` or later.',
          \ s:DENO_VERSION,
          \))
    return
  endif
  call s:report_ok('Deno version check: passed')
endfunction

function! s:check_vim_version() abort
  call s:report_info(printf(
        \ 'Supported Vim version: `%s`',
        \ s:VIM_VERSION,
        \))
  call s:report_info(printf(
        \ 'Detected Vim version: `%s`',
        \ denops#_internal#meta#get().version,
        \))
  if !has(printf('patch-%s', s:VIM_VERSION))
    call s:report_error(printf(
          \ 'Unsupported Vim version is detected. You need to upgrade it to `%s` or later.',
          \ s:VIM_VERSION,
          \))
    return
  endif
  call s:report_ok('Vim version check: passed')
endfunction

function! s:check_neovim_version() abort
  call s:report_info(printf(
        \ 'Supported Neovim version: `%s`',
        \ s:NEOVIM_VERSION,
        \))
  call s:report_info(printf(
        \ 'Detected Neovim version: `%s`',
        \ denops#_internal#meta#get().version,
        \))
  if !has(printf('nvim-%s', s:NEOVIM_VERSION))
    call s:report_error(printf(
          \ 'Unsupported Neovim version is detected. You need to upgrade it to `%s` or later.',
          \ s:NEOVIM_VERSION,
          \))
    return
  endif
  call s:report_ok('Neovim version check: passed')
endfunction

function! s:check_denops() abort
  if get(g:, 'denops#debug', 0)
    call s:report_warn('Denops is running with debug mode (g:denops#debug)')
  endif
endfunction

function! s:check_denops_status() abort
  let l:server_status = denops#server#status()
  call s:report_info(printf(
        \ 'Denops status: `%s`',
        \ l:server_status,
        \))
  if l:server_status ==# 'stopped'
    call s:report_error('Denops is stopped. Execute `:message` command to find reasons.')
    return
  endif
  call s:report_ok('Denops status check: passed')
endfunction

if has('nvim-0.10')
  function! s:report_ok(report) abort
    call v:lua.vim.health.ok(a:report)
  endfunction

  function! s:report_info(report) abort
    call v:lua.vim.health.info(a:report)
  endfunction

  function! s:report_warn(report) abort
    call v:lua.vim.health.warn(a:report)
  endfunction

  function! s:report_error(report) abort
    call v:lua.vim.health.error(a:report)
  endfunction
else
  function! s:report_ok(report) abort
    call health#report_ok(a:report)
  endfunction

  function! s:report_info(report) abort
    call health#report_info(a:report)
  endfunction

  function! s:report_warn(report) abort
    call health#report_warn(a:report)
  endfunction

  function! s:report_error(report) abort
    call health#report_error(a:report)
  endfunction
endif

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
