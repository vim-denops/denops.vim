let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h:h')
let s:script = join([s:root, 'denops', 'denops', 'cli.ts'], s:sep)

function! denops#server#vim#start(exec, args, on_err, on_exit) abort
  if !executable(a:exec)
    throw printf('[denops] deno is not executable: %s', s:deno)
  elseif !filereadable(s:script)
    throw printf('[denops] No denops server script file exists: %s', s:script)
  endif
  let args = [a:exec, 'run'] + a:args + [s:script, '--mode=vim', '--debug=true']
  let job = job_start(args, {
        \ 'noblock': 1,
        \ 'mode': 'json',
        \ 'err_mode': 'nl',
        \ 'err_cb': funcref('s:err_cb', [a:on_err]),
        \ 'exit_cb': funcref('s:exit_cb', [a:on_exit]),
        \ 'env': {
        \   'NO_COLOR': 1,
        \ }
        \})
  return job
endfunction

function! denops#server#vim#notify(server, method, params) abort
  call ch_sendraw(a:server, json_encode([0, [a:method] + a:params]) . "\n")
endfunction

function! denops#server#vim#request(server, method, params) abort
  return ch_evalexpr(a:server, [a:method] + a:params)
endfunction

function! s:err_cb(callback, ch, msg) abort
  call a:callback(split(a:msg, '\n'))
endfunction

function! s:exit_cb(callback, ch, status) abort
  call a:callback(a:status)
endfunction
