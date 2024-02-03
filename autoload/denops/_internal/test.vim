if has('nvim')
  function! denops#_internal#test#notify(method, params) abort
    return denops#_internal#rpc#nvim#notify(#{ _id : g:denops_test_channel }, a:method, a:params)
  endfunction

  function! denops#_internal#test#request(method, params) abort
    return denops#_internal#rpc#nvim#request(#{ _id : g:denops_test_channel }, a:method, a:params)
  endfunction
else
  function! denops#_internal#test#notify(method, params) abort
    return denops#_internal#rpc#vim#notify(g:denops_test_channel, a:method, a:params)
  endfunction

  function! denops#_internal#test#request(method, params) abort
    return denops#_internal#rpc#vim#request(g:denops_test_channel, a:method, a:params)
  endfunction
endif
