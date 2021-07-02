function! denops#notify(plugin, method, params) abort
  return denops#server#channel#notify('invoke', ['dispatch', [a:plugin, a:method, a:params]])
endfunction

function! denops#request(plugin, method, params) abort
  return denops#server#channel#request('invoke', ['dispatch', [a:plugin, a:method, a:params]])
endfunction

function! denops#request_async(plugin, method, params, success, failure) abort
  let success = denops#callback#add(a:success)
  let failure = denops#callback#add(a:failure)
  return denops#server#channel#request('invoke', ['dispatchAsync', [a:plugin, a:method, a:params, success, failure]])
endfunction

" Configuration
let g:denops#deno = get(g:, 'denops#deno', 'deno')
let g:denops#debug = get(g:, 'denops#debug', 0)

" Internal configuration
let g:denops#_test = get(g:, 'denops#_test', 0)
