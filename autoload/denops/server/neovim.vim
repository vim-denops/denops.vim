let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h:h')
let s:script = join([s:root, 'denops', 'denops', 'cli.ts'], s:sep)

function! denops#server#neovim#start(exec, args, on_err, on_exit) abort
  if !executable(a:exec)
    throw printf('[denops] deno is not executable: %s', s:deno)
  elseif !filereadable(s:script)
    throw printf('[denops] No denops server script file exists: %s', s:script)
  endif
  let args = [a:exec, 'run'] + a:args + [s:script, '--mode=neovim', '--debug=true']
  let job = jobstart(args, {
        \ 'rpc': v:true,
        \ 'on_stderr': { j, d, e -> a:on_err(d) },
        \ 'on_exit': { j, d, e -> a:on_exit(d) },
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
