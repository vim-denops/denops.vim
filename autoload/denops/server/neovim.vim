let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h:h')
let s:script = join([s:root, 'denops', 'denops', 'neovim.ts'], s:sep)

function! denops#server#neovim#start(exec, args) abort
  if !executable(a:exec)
    throw printf('[denops] deno is not executable: %s', s:deno)
  elseif !filereadable(s:script)
    throw printf('[denops] No denops server script file exists: %s', s:script)
  endif
  let args = [a:exec, 'run'] + a:args + [s:script, 'neovim']
  let job = jobstart(args, {
        \ 'rpc': v:true,
        \ 'on_stderr': funcref('s:on_stderr'),
        \ 'on_exit': funcref('s:on_exit'),
        \ 'env': {
        \   'NO_COLOR': 1,
        \ }
        \})
  return job
endfunction

function! denops#server#neovim#notify(server, method, params) abort
  call call('rpcnotify', [a:server, a:method] + a:params)
endfunction

function! denops#server#neovim#request(server, method, params) abort
  return call('rpcrequest', [a:server, a:method] + a:params)
endfunction

function! s:on_stderr(job, data, event) abort
  echohl ErrorMsg
  for line in a:data
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! s:on_exit(job, data, event) abort
  echohl Comment
  echomsg printf('[denops] Denops server is closed: %d', a:data)
  echohl None
endfunction
