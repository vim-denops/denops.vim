let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h')

function! denops#util#script_path(...) abort
  return join([s:root, 'denops', 'denops'] + a:000, s:sep)
endfunction

