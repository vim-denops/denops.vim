function! denops#notify(plugin, method, params) abort
  return denops#server#notify('invoke', ['dispatch', [a:plugin, a:method, a:params]])
endfunction

function! denops#request(plugin, method, params) abort
  return denops#server#request('invoke', ['dispatch', [a:plugin, a:method, a:params]])
endfunction

function! denops#request_async(plugin, method, params, success, failure) abort
  let l:success = denops#callback#register(a:success, {
        \ 'once': v:true,
        \})
  let l:failure = denops#callback#register(a:failure, {
        \ 'once': v:true,
        \})
  return denops#server#request('invoke', ['dispatchAsync', [a:plugin, a:method, a:params, l:success, l:failure]])
endfunction

function! s:define(name, default) abort
  let g:{a:name} = get(g:, a:name, a:default)
endfunction

" Configuration
call s:define('denops#disabled', 0)
call s:define('denops#deno', 'deno')
call s:define('denops#debug', 0)
call s:define('denops#trace', 0)
call s:define('denops#type_check', 0)
call s:define('denops#disable_deprecation_warning_message', 0)

" Internal configuration
call s:define('denops#_test', 0)
