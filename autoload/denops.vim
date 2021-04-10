function! denops#debug(...) abort
  let msg = join(a:000)
  echohl Comment
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! denops#info(...) abort
  let msg = join(a:000)
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
endfunction

function! denops#error(...) abort
  let msg = join(a:000)
  echohl ErrorMsg
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! denops#notify(plugin, method, params) abort
  return denops#server#channel#notify('dispatch', [a:plugin, a:method, a:params])
endfunction

function! denops#request(plugin, method, params) abort
  return denops#server#channel#request('dispatch', [a:plugin, a:method, a:params])
endfunction

function! denops#promise(plugin, method, params) abort
  return denops#lib#promise#new(funcref('s:promise_start', [a:plugin, a:method, a:params]))
endfunction

function! s:promise_start(plugin, method, params, resolve, reject) abort
  let success = denops#callback#add(a:resolve)
  let failure = denops#callback#add(a:reject)
  return denops#server#channel#request('dispatchAsync', [a:plugin, a:method, a:params, success, failure])
endfunction

" Configuration
let g:denops#deno = get(g:, 'denops#deno', exepath('deno'))
