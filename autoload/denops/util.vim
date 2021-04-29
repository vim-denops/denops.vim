let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h')

function! denops#util#script_path(...) abort
  return call('denops#util#join_path', [s:root, 'denops', '@denops'] + a:000)
endfunction

function! denops#util#join_path(...) abort
  return join(a:000, s:sep)
endfunction

function! denops#util#jobstart(args, ...) abort
  let options = extend({
        \ 'pty': 0,
        \ 'env': {},
        \ 'on_stdout': { -> 0 },
        \ 'on_stderr': { -> 0 },
        \ 'on_exit': { -> 0 },
        \ 'raw_options': {},
        \}, a:0 ? a:1 : {},
        \)
  return s:start(a:args, options)
endfunction

function! denops#util#jobstop(job) abort
  call s:stop(a:job)
endfunction

if has('nvim')
  function! s:start(args, options) abort
    let options = extend({
          \ 'pty': a:options.pty,
          \ 'env': a:options.env,
          \ 'on_stdout': funcref('s:on_recv', [a:options.on_stdout]),
          \ 'on_stderr': funcref('s:on_recv', [a:options.on_stderr]),
          \ 'on_exit': funcref('s:on_exit', [a:options.on_exit]),
          \}, a:options.raw_options)
    return jobstart(a:args, options)
  endfunction

  function! s:stop(job) abort
    try
      call jobstop(a:job)
    catch /^Vim\%((\a\+)\)\=:E900/
      " NOTE:
      " Vim does not raise exception even the job has already closed so fail
      " silently for 'E900: Invalid job id' exception
    endtry
  endfunction

  function! s:on_recv(callback, job, data, event) abort
    call a:callback(join(a:data, "\n"))
  endfunction

  function! s:on_exit(callback, job, status, event) abort
    call a:callback(a:status)
  endfunction
else
  " https://github.com/neovim/neovim/blob/f629f83/src/nvim/event/process.c#L24-L26
  let s:KILL_TIMEOUT_MS = 2000

  function! s:start(args, options) abort
    let options = extend({
          \ 'pty': a:options.pty,
          \ 'env': a:options.env,
          \ 'out_cb': funcref('s:out_cb', [a:options.on_stdout]),
          \ 'err_cb': funcref('s:out_cb', [a:options.on_stderr]),
          \ 'exit_cb': funcref('s:exit_cb', [a:options.on_exit]),
          \}, a:options.raw_options)
    return job_start(a:args, options)
  endfunction

  function! s:stop(job) abort
    call job_stop(a:job)
    call timer_start(s:KILL_TIMEOUT_MS, { -> job_stop(a:job, 'kill') })
  endfunction

  function! s:out_cb(callback, ch, msg) abort
    call a:callback(a:msg)
  endfunction

  function! s:exit_cb(callback, ch, status) abort
    call a:callback(a:status)
  endfunction
endif
