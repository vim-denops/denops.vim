let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h')
let s:wait_warning_time = 5000

function! denops#util#meta() abort
  let l:mode = g:denops#_test ? 'test' : g:denops#debug ? 'debug' : 'release'
  if exists('s:meta')
    return extend({'mode': l:mode}, s:meta, 'keep')
  endif
  let l:host = has('nvim') ? 'nvim' : 'vim'
  let l:version = s:get_host_version()
  let l:platform = has('win32') ? 'windows' : has('mac') ? 'mac' : 'linux'
  let s:meta = {
        \ 'mode': l:mode,
        \ 'host': l:host,
        \ 'version': l:version,
        \ 'platform': l:platform,
        \}
  return s:meta
endfunction

" DEPRECATED:
function! denops#util#debug(...) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#debug` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  call call('denops#_internal#echo#debug', a:000)
endfunction

" DEPRECATED:
function! denops#util#info(...) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#info` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  call call('denops#_internal#echo#info', a:000)
endfunction

" DEPRECATED:
function! denops#util#warn(...) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#warn` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  call call('denops#_internal#echo#warn', a:000)
endfunction

" DEPRECATED:
function! denops#util#error(...) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#error` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  call call('denops#_internal#echo#error', a:000)
endfunction

if has('win32unix')
  function! denops#util#normalize_path(path) abort
    return trim(system(printf("cygpath -m '%s'", a:path)))
  endfunction

  function! denops#util#script_path(...) abort
    return denops#util#normalize_path(call('denops#util#join_path', [s:root, 'denops'] + a:000))
  endfunction
else
  function! denops#util#normalize_path(path) abort
    return a:path
  endfunction

  function! denops#util#script_path(...) abort
    return call('denops#util#join_path', [s:root, 'denops'] + a:000)
  endfunction
endif

function! denops#util#join_path(...) abort
  return join(a:000, s:sep)
endfunction

function! denops#util#wait(timeout, condition, interval) abort
  return s:wait(a:timeout, a:condition, a:interval)
endfunction

function! s:warn_wait() abort
  let l:m = printf(
        \ 'It tooks more than %d ms. Use Ctrl-C to cancel.',
        \ s:wait_warning_time,
        \)
  call denops#util#warn(l:m)
endfunction

if exists('*wait')
  function! s:wait(timeout, condition, interval) abort
    let l:t = timer_start(
          \ s:wait_warning_time,
          \ { -> s:warn_wait() },
          \)
    try
      return wait(a:timeout, a:condition, a:interval)
    finally
      silent! call timer_stop(l:t)
    endtry
  endfunction
else
  function! s:wait(timeout, condition, interval) abort
    let l:t = timer_start(
          \ s:wait_warning_time,
          \ { -> s:warn_wait() },
          \)
    let l:waiter = printf('sleep %dm', a:interval)
    let l:s = reltime()
    try
      while !a:condition()
        if reltimefloat(reltime(l:s)) * 1000 > a:timeout
          return -1
        endif
        execute l:waiter
      endwhile
    catch /^Vim:Interrupt$/
      return -2
    finally
      silent! call timer_stop(l:t)
    endtry
  endfunction
endif

if has('nvim')
  function! s:get_host_version() abort
    let l:output = execute('version')
    return matchstr(l:output, 'NVIM v\zs[0-9.]\+')
  endfunction
else
  function! s:get_host_version() abort
    let l:output = execute('version')
    let l:major = matchstr(l:output, 'Vi IMproved \zs[0-9.]\+')
    let l:patch = matchstr(l:output, 'Included patches: [0-9]\+-\zs[0-9]\+')
    return printf('%s.%s', l:major, l:patch)
  endfunction
endif
