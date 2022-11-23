let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h')

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

" DEPRECATED
function! denops#util#wait(...) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#wait` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  call call('denops#_internal#wait#for', a:000)
endfunction
