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

function! denops#register(plugin, script) abort
  return denops#server#notify('register', [a:plugin, a:script])
endfunction

function! denops#notify(plugin, method, params) abort
  return denops#server#notify('dispatch', [a:plugin, a:method, a:params])
endfunction

function! denops#request(plugin, method, params) abort
  return denops#server#request('dispatch', [a:plugin, a:method, a:params])
endfunction
