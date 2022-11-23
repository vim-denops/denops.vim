let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h')
let s:wait_warning_time = 5000

" DEPRECATED:
function! denops#util#meta() abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#meta` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  return denops#_internal#meta#get()
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
