let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h:h')
let s:script = join([s:root, 'denops', 'denops', 'vim.ts'], s:sep)

function! denops#server#vim#start(exec, args) abort
  if !executable(a:exec)
    throw printf('[denops] deno is not executable: %s', s:deno)
  elseif !filereadable(s:script)
    throw printf('[denops] No denops server script file exists: %s', s:script)
  endif
  let args = [a:exec, 'run'] + a:args + [s:script]
  let job = job_start(args, {
        \ 'noblock': 1,
        \ 'mode': 'json',
        \ 'err_mode': 'nl',
        \ 'err_cb': funcref('s:err_cb'),
        \ 'exit_cb': funcref('s:exit_cb'),
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

function! s:err_cb(ch, msg) abort
  echohl ErrorMsg
  for line in split(a:msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! s:exit_cb(ch, status) abort
  echohl Comment
  echomsg printf('[denops] Denops server is closed: %d', a:status)
  echohl None
endfunction
