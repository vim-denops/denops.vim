let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h')
let s:wait_warning_time = 5000

function! denops#util#meta() abort
  let mode = g:denops#_test ? 'test' : g:denops#debug ? 'debug' : 'release'
  if exists('s:meta')
    return extend({'mode': mode}, s:meta, 'keep')
  endif
  let l:host = has('nvim') ? 'nvim' : 'vim'
  let l:version = s:get_host_version()
  let l:platform = has('win32') ? 'windows' : has('mac') ? 'mac' : 'linux'
  let s:meta = {
        \ 'mode': mode,
        \ 'host': l:host,
        \ 'version': l:version,
        \ 'platform': l:platform,
        \}
  return s:meta
endfunction

function! denops#util#debug(...) abort
  if !g:denops#debug
    return
  endif
  let msg = join(a:000)
  echohl Comment
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! denops#util#info(...) abort
  let msg = join(a:000)
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
endfunction

function! denops#util#warn(...) abort
  let msg = join(a:000)
  echohl WarningMsg
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! denops#util#error(...) abort
  let msg = join(a:000)
  echohl ErrorMsg
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
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
  let m = printf(
        \ 'It tooks more than %d ms. Use Ctrl-C to cancel.',
        \ s:wait_warning_time,
        \)
  call denops#util#warn(m)
endfunction

if exists('*wait')
  function! s:wait(timeout, condition, interval) abort
    let t = timer_start(
          \ s:wait_warning_time,
          \ { -> s:warn_wait() },
          \)
    try
      return wait(a:timeout, a:condition, a:interval)
    finally
      silent! call timer_stop(t)
    endtry
  endfunction
else
  function! s:wait(timeout, condition, interval) abort
    let t = timer_start(
          \ s:wait_warning_time,
          \ { -> s:warn_wait() },
          \)
    let waiter = printf('sleep %dm', a:interval)
    let s = reltime()
    try
      while !a:condition()
        if reltimefloat(reltime(s)) * 1000 > a:timeout
          return -1
        endif
        execute waiter
      endwhile
    catch /^Vim:Interrupt$/
      return -2
    finally
      silent! call timer_stop(t)
    endtry
  endfunction
endif

if has('nvim')
  function! s:get_host_version() abort
    let output = execute('version')
    return matchstr(output, 'NVIM v\zs[0-9.]\+')
  endfunction
else
  function! s:get_host_version() abort
    let output = execute('version')
    let major = matchstr(output, 'Vi IMproved \zs[0-9.]\+')
    let patch = matchstr(output, 'Included patches: [0-9]\+-\zs[0-9]\+')
    return printf('%s.%s', major, patch)
  endfunction
endif
