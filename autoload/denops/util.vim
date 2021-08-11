let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h')

function! denops#util#meta() abort
  let mode = g:denops#_test ? 'test' : g:denops#debug ? 'debug' : 'release'
  if exists('s:meta')
    return extend({'mode': mode}, s:meta, 'keep')
  endif
  let l:host = has('nvim') ? 'nvim' : 'vim'
  let l:version = s:get_host_version()
  let l:platform = has('win32') ? 'windows' : has('mac') ? 'mac' : 'linux'
  let s:meta = {
        \ 'mode': mode,
        \ 'host': l:host,
        \ 'version': l:version,
        \ 'platform': l:platform,
        \}
  return s:meta
endfunction

function! denops#util#debug(...) abort
  if !g:denops#debug
    return
  endif
  let msg = join(a:000)
  echohl Comment
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! denops#util#info(...) abort
  let msg = join(a:000)
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
endfunction

function! denops#util#error(...) abort
  let msg = join(a:000)
  echohl ErrorMsg
  for line in split(msg, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! denops#util#script_path(...) abort
  return call('denops#util#join_path', [s:root, 'denops'] + a:000)
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
  function! s:get_host_version() abort
    let output = execute('version')
    return matchstr(output, 'NVIM v\zs[0-9.]\+')
  endfunction

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
  function! s:get_host_version() abort
    let output = execute('version')
    let major = matchstr(output, 'Vi IMproved \zs[0-9.]\+')
    let patch = matchstr(output, 'Included patches: [0-9]\+-\zs[0-9]\+')
    return printf('%s.%s', major, patch)
  endfunction

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
