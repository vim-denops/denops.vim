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

" Configuration
call denops#_internal#conf#define('denops#disabled', 0)
call denops#_internal#conf#define('denops#deno', 'deno')
call denops#_internal#conf#define('denops#debug', 0)
call denops#_internal#conf#define('denops#trace', 0)
call denops#_internal#conf#define('denops#disable_deprecation_warning_message', 0)

" Internal configuration
call denops#_internal#conf#define('denops#_test', 0)

" Check deprecated features and show warning messages
if exists('g:denops#type_check')
  " Since denops v4.0.0
  call denops#_internal#echo#deprecate(
        \ 'g:denops#type_check is deprecated and does nothing. Use denops#plugin#check_type() function instead.'
        \)
endif
