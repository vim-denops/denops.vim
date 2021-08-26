function! denops#notify(plugin, method, params) abort
  return denops#server#notify('invoke', ['dispatch', [a:plugin, a:method, a:params]])
endfunction

function! denops#request(plugin, method, params) abort
  return denops#server#request('invoke', ['dispatch', [a:plugin, a:method, a:params]])
endfunction

function! denops#request_async(plugin, method, params, success, failure) abort
  let success = denops#callback#add(a:success)
  let failure = denops#callback#add(a:failure)
  return denops#server#request('invoke', ['dispatchAsync', [a:plugin, a:method, a:params, success, failure]])
endfunction

function! s:define(name, default) abort
  let g:{a:name} = get(g:, a:name, a:default)
endfunction

" Configuration
call s:define('denops#deno', 'deno')
call s:define('denops#debug', 0)
call s:define('denops#trace', 0)
call s:define('denops#enable_workaround_vim_before_8_2_3081', 0)

" Internal configuration
call s:define('denops#_test', 0)
