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
    return jobstart(a:args, l:options)
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
  " https://github.com/neovim/neovim/blob/cb24a3907c8d24a898d99042f0f16c8919a2e7ab/src/nvim/event/process.c#L28
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
    return job_start(a:args, l:options)
  endfunction

  function! s:stop(job) abort
    call job_stop(a:job)
    call timer_start(s:KILL_TIMEOUT_MS, { -> job_stop(a:job, 'kill') })
  endfunction

  function! s:out_cb(callback, event, ch, msg) abort
    call a:callback(a:ch, a:msg, a:event)
  endfunction

  function! s:exit_cb(callback, event, ch, status) abort
    call a:callback(a:ch, a:status, a:event)
  endfunction
endif
