let s:script = denops#util#script_path('@denops-private', 'cli.ts')
let s:engine = has('nvim') ? 'nvim' : 'vim'
let s:vim_exiting = 0
let s:stopped_by_user = 0
let s:job = v:null
let s:chan = v:null
let s:STATUS_STOPPED = 'stopped'
let s:STATUS_STARTING = 'starting'
let s:STATUS_RUNNING = 'running'

function! denops#server#start() abort
  if denops#server#status() isnot# s:STATUS_STOPPED
    call denops#util#debug('Server is already starting or running. Skip')
    return
  endif
  let args = [g:denops#server#deno, 'run']
  let args += g:denops#server#deno_args
  let args += [
        \ s:script,
        \ '--mode=' . s:engine,
        \]
  if g:denops#trace
    let args += ['--trace']
  endif
  let raw_options = has('nvim')
        \ ? {}
        \ : { 'mode': 'nl' }
  let s:stopped_by_user = 0
  let s:chan = v:null
  let s:job = denops#job#start(args, {
        \ 'env': {
        \   'NO_COLOR': 1,
        \ },
        \ 'on_stdout': funcref('s:on_stdout'),
        \ 'on_stderr': funcref('s:on_stderr'),
        \ 'on_exit': funcref('s:on_exit'),
        \ 'raw_options': raw_options,
        \})
  call denops#util#debug(printf('Server spawned: %s', args))
  doautocmd <nomodeline> User DenopsStarted
endfunction

function! denops#server#stop() abort
  if s:job isnot# v:null
    let s:stopped_by_user = 1
    call denops#job#stop(s:job)
  endif
endfunction

function! denops#server#restart() abort
  call denops#server#stop()
  call denops#server#start()
endfunction

function! denops#server#status() abort
  if s:job isnot# v:null && s:chan isnot# v:null
    return s:STATUS_RUNNING
  elseif s:job isnot# v:null
    return s:STATUS_STARTING
  else
    return s:STATUS_STOPPED
  endif
endfunction

function! denops#server#notify(method, params) abort
  if denops#server#status() isnot# s:STATUS_RUNNING
    throw printf('The server is not ready yet')
  endif
  return s:notify(s:chan, a:method, a:params)
endfunction

function! denops#server#request(method, params) abort
  if denops#server#status() isnot# s:STATUS_RUNNING
    throw printf('The server is not ready yet')
  endif
  return s:request(s:chan, a:method, a:params)
endfunction

function! s:on_stdout(data) abort
  if s:chan isnot# v:null
    for line in split(a:data, '\n')
      echomsg printf('[denops] %s', line)
    endfor
    return
  endif
  let addr = substitute(a:data, '\r\?\n$', '', 'g')
  call denops#util#debug(printf('Connecting to `%s`', addr))
  let s:chan = s:connect(addr)
  doautocmd <nomodeline> User DenopsReady
endfunction

function! s:on_stderr(data) abort
  echohl ErrorMsg
  for line in split(a:data, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! s:on_exit(status, ...) abort dict
  let s:job = v:null
  let s:chan = v:null
  call denops#util#debug(printf('Server stopped: %s', a:status))
  doautocmd <nomodeline> User DenopsStopped
  if s:stopped_by_user || v:dying || s:vim_exiting
    return
  endif
  call denops#util#warn(printf(
        \ 'Server stopped (%d). Restarting...',
        \ a:status,
        \))
  call denops#server#start()
endfunction

if has('nvim')
  function! s:connect(address) abort
    let chan = sockconnect('tcp', a:address, {
          \ 'rpc': v:true,
          \})
    if chan is# 0
      throw printf('Failed to connect `%s`', a:address)
    endif
    return chan
  endfunction

  function! s:notify(chan, method, params) abort
    return call('rpcnotify', [a:chan, a:method] + a:params)
  endfunction

  function! s:request(chan, method, params) abort
    return call('rpcrequest', [a:chan, a:method] + a:params)
  endfunction
else
  function! s:connect(address) abort
    let chan = ch_open(a:address, {
          \ 'mode': 'json',
          \ 'drop': 'auto',
          \ 'noblock': 1,
          \ 'timeout': 60 * 60 * 24 * 7,
          \})
    if ch_status(chan) !=# 'open'
      throw printf('Failed to connect `%s`', a:address)
    endif
    return chan
  endfunction

  function! s:notify(chan, method, params) abort
    return ch_sendraw(a:chan, json_encode([0, [a:method] + a:params]) . "\n")
  endfunction

  function! s:request(chan, method, params) abort
    let [ok, err] = ch_evalexpr(a:chan, [a:method] + a:params)
    if err isnot# v:null
      throw err
    endif
    return ok
  endfunction
endif

augroup denops_server_internal
  autocmd!
  autocmd User DenopsStarted :
  autocmd User DenopsStopped :
  autocmd User DenopsReady :
  autocmd VimLeave * let s:vim_exiting = 1
augroup END

augroup denops_server_internal_deprecated
  autocmd!
  autocmd User DenopsStarted ++nested doautocmd <nomodeline> User DenopsChannelStarted
  autocmd User DenopsStarted ++nested doautocmd <nomodeline> User DenopsServiceStarted
  autocmd User DenopsStopped ++nested doautocmd <nomodeline> User DenopsChannelStopped
  autocmd User DenopsStopped ++nested doautocmd <nomodeline> User DenopsServiceStopped
  autocmd User DenopsChannelStarted :
  autocmd User DenopsServiceStarted :
  autocmd User DenopsChannelStopped :
  autocmd User DenopsServiceStopped :
augroup END

" Deprecated
if exists('g:denops#server#service#deno')
  call denops#util#warn('g:denops#server#service#deno is deprecated. Use g:denops#server#deno instead')
  let g:denops#server#deno = g:denops#server#service#deno
endif
if exists('g:denops#server#service#deno_args')
  call denops#util#warn('g:denops#server#service#deno_args is deprecated. Use g:denops#server#deno_args instead')
  let g:denops#server#deno_args = g:denops#server#service#deno_args
endif

" Obsoleted
if exists('g:denops#server#channel#deno')
  call denops#util#warn('g:denops#server#channel#deno is obsoleted')
endif
if exists('g:denops#server#channel#deno_args')
  call denops#util#warn('g:denops#server#channel#deno_args is obsoleted')
endif

let g:denops#server#deno = get(g:, 'denops#server#deno', g:denops#deno)
let g:denops#server#deno_args = get(g:, 'denops#server#deno_args', filter([
      \ '-q',
      \ g:denops#debug ? '' : '--no-check',
      \ '--unstable',
      \ '-A',
      \], { _, v -> !empty(v) }))
