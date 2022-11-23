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

" DEPRECATED:
function! denops#util#join_path(...) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#join_path` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  return denops#_internal#path#join(a:000)
endfunction

" DEPRECATED:
function! denops#util#normalize_path(path) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#normalize_path` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  return denops#_internal#path#norm(a:path)
endfunction

" DEPRECATED:
function! denops#util#script_path(...) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#script_path` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  return denops#_internal#path#script(a:000)
endfunction

" DEPRECATED
function! denops#util#wait(...) abort
  call denops#_internal#echo#deprecate(
        \ 'The function `denops#util#wait` is deprecated and will be removed.',
        \ 'Denops does not provide a public alternative so plugins must define it by themselves.',
        \)
  call call('denops#_internal#wait#for', a:000)
endfunction
