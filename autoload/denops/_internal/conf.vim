function! denops#_internal#conf#define(name, default) abort
  let g:{a:name} = get(g:, a:name, a:default)
endfunction
