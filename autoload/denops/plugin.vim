function! denops#plugin#register(name, script) abort
  call denops#server#notify('register', [a:name, a:script])
endfunction
