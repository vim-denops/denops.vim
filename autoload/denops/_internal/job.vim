function! denops#_internal#job#start(args, ...) abort
  let l:options = extend({
        \ 'pty': 0,
        \ 'env': {},
        \ 'on_stdout': { -> 0 },
        \ 'on_stderr': { -> 0 },
        \ 'on_exit': { -> 0 },
        \}, a:0 ? a:1 : {},
        \)
  return s:start(a:args, l:options)
endfunction

function! denops#_internal#job#stop(job) abort
  call s:stop(a:job)
endfunction

if has('nvim')
  function! s:start(args, options) abort
    let l:options = {
          \ 'mode': 'nl',
          \ 'pty': a:options.pty,
          \ 'env': a:options.env,
          \ 'on_stdout': funcref('s:on_recv', [a:options.on_stdout]),
          \ 'on_stderr': funcref('s:on_recv', [a:options.on_stderr]),
          \ 'on_exit': funcref('s:on_exit', [a:options.on_exit]),
          \}
    try
      return jobstart(a:args, l:options)
    catch
      " NOTE: Call `on_exit` when cmd (args[0]) is not executable.
      call timer_start(0, { -> l:options.on_exit(-1, -1, 'exit') })
    endtry
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
    call a:callback(a:job, join(a:data, "\n"), a:event)
  endfunction

  function! s:on_exit(callback, job, status, event) abort
    call a:callback(a:job, a:status, a:event)
  endfunction
else
  " https://github.com/neovim/neovim/blob/f629f83/src/nvim/event/process.c#L24-L26
  let s:KILL_TIMEOUT_MS = 2000

  function! s:start(args, options) abort
    let l:options = {
          \ 'noblock': 1,
          \ 'pty': a:options.pty,
          \ 'env': a:options.env,
          \ 'out_cb': funcref('s:out_cb', [a:options.on_stdout, 'stdout']),
          \ 'err_cb': funcref('s:out_cb', [a:options.on_stderr, 'stderr']),
          \ 'exit_cb': funcref('s:exit_cb', [a:options.on_exit, 'exit']),
          \}
    let l:job = job_start(a:args, l:options)
    if l:job->job_status() ==# "fail"
      " NOTE:
      " On Windows call `on_exit` when cmd (args[0]) is not executable.
      " On Unix a non-existing command results in "dead" instead of "fail",
      " and `on_exit` is called by `job_start()`.
      call timer_start(0, { -> l:options.exit_cb(-1, -1) })
    endif
    return l:job
  endfunction

  function! s:stop(job) abort
    call job_stop(a:job)
    call timer_start(s:KILL_TIMEOUT_MS, { -> job_stop(a:job, 'kill') })
  endfunction

  function! s:out_cb(callback, event, job, msg) abort
    call a:callback(a:job, a:msg, a:event)
  endfunction

  function! s:exit_cb(callback, event, job, status) abort
    call a:callback(a:job, a:status, a:event)
  endfunction
endif
