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

function! denops#call(plugin, method, ...) abort
  return denops#server#request('dispatch', a:plugin, a:method, a:000)
endfunction
