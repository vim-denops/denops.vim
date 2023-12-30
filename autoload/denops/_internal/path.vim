const s:SEP = has('win32') ? '\' : '/'
const s:ROOT = expand('<sfile>:h:h:h:h')

function! denops#_internal#path#join(paths) abort
  return join(a:paths, s:SEP)
endfunction

function! denops#_internal#path#norm(path) abort
  return s:norm(a:path)
endfunction

function! denops#_internal#path#script(paths) abort
  return s:script(a:paths)
endfunction

if has('win32unix')
  function! s:norm(path) abort
    return trim(system(printf("cygpath -m '%s'", a:path)))
  endfunction

  function! s:script(paths) abort
    return s:norm(denops#_internal#path#join([s:ROOT, 'denops'] + a:paths))
  endfunction
else
  function! s:norm(path) abort
    return a:path
  endfunction

  function! s:script(paths) abort
    return denops#_internal#path#join([s:ROOT, 'denops'] + a:paths)
  endfunction
endif
