function! denops#notify(name, method, params) abort
  call denops#_internal#server#chan#notify(
        \ 'invoke',
        \ ['dispatch', [a:name, a:method, a:params]],
        \)
endfunction

function! denops#request(name, method, params) abort
  return denops#_internal#server#chan#request(
        \ 'invoke',
        \ ['dispatch', [a:name, a:method, a:params]],
        \)
endfunction

function! denops#request_async(name, method, params, success, failure) abort
  let l:success = denops#callback#register(a:success, {
        \ 'once': v:true,
        \})
  let l:failure = denops#callback#register(a:failure, {
        \ 'once': v:true,
        \})
  return denops#_internal#server#chan#notify(
        \ 'invoke',
        \ ['dispatchAsync', [a:name, a:method, a:params, l:success, l:failure]],
        \)
endfunction

" Configuration
call denops#_internal#conf#define('denops#disabled', 0)
call denops#_internal#conf#define('denops#deno', 'deno')
call denops#_internal#conf#define('denops#deno_dir', v:null)
call denops#_internal#conf#define('denops#debug', 0)
call denops#_internal#conf#define('denops#disable_deprecation_warning_message', 0)

" Internal configuration
call denops#_internal#conf#define('denops#_test', 0)
