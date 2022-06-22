let s:script = denops#util#script_path('@denops-private', 'cli.ts')
let s:engine = has('nvim') ? 'nvim' : 'vim'
let s:vim_exiting = 0
let s:stopped_on_purpose = 0
let s:job = v:null
let s:chan = v:null
let s:STATUS_STOPPED = 'stopped'
let s:STATUS_STARTING = 'starting'
let s:STATUS_RUNNING = 'running'

function! denops#server#connect(addr) abort
  call denops#util#debug(printf('Connecting to `%s`', a:addr))
  try
    let s:chan = s:connect(a:addr)
  catch
    call denops#util#error(printf('Failed to connect denops server (%s): %s', a:addr, v:exception))
    return
  endtry
  doautocmd <nomodeline> User DenopsReady
  return v:true
endfunction

function! denops#server#start() abort
  if g:denops#disabled
    return
  elseif denops#server#status() isnot# s:STATUS_STOPPED
    call denops#util#debug('Server is already starting or running. Skip')
    return
  endif
  let args = [g:denops#server#deno, 'run']
  let args += g:denops#server#deno_args
  let args += [
        \ s:script,
        \ '--quiet',
        \ '--identity',
        \ '--port', '0',
        \]
  if g:denops#trace
    let args += ['--trace']
  endif
  let raw_options = has('nvim')
        \ ? {}
        \ : { 'mode': 'nl' }
  let s:stopped_on_purpose = 0
  let s:chan = v:null
  let s:job = denops#job#start(args, {
        \ 'env': {
        \   'NO_COLOR': 1,
        \   'DENO_NO_PROMPT': 1,
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
    call s:stop(v:false)
  endif
endfunction

function! denops#server#restart() abort
  if s:job isnot# v:null
    call s:stop(v:true)
  else
    call denops#server#start()
  endif
endfunction

function! denops#server#status() abort
  if s:chan isnot# v:null
    return s:STATUS_RUNNING
  elseif s:job isnot# v:null
    return s:STATUS_STARTING
  else
    return s:STATUS_STOPPED
  endif
endfunction

function! denops#server#notify(method, params) abort
  if g:denops#disabled
    return
  elseif denops#server#status() isnot# s:STATUS_RUNNING
    throw printf('The server is not ready yet')
  endif
  return s:notify(s:chan, a:method, a:params)
endfunction

function! denops#server#request(method, params) abort
  if g:denops#disabled
    return
  elseif denops#server#status() isnot# s:STATUS_RUNNING
    throw printf('The server is not ready yet')
  endif
  return s:request(s:chan, a:method, a:params)
endfunction

function! s:on_stdout(data) abort
  if s:chan isnot# v:null
    for line in split(a:data, '\n')
      echomsg printf('[denops] %s', substitute(line, '\t', '    ', 'g'))
    endfor
    return
  endif
  let addr = substitute(a:data, '\r\?\n$', '', 'g')
  if !denops#server#connect(addr)
    call denops#server#stop()
    call s:on_stderr(a:data)
    return
  endif
endfunction

function! s:on_stderr(data) abort
  echohl ErrorMsg
  for line in split(a:data, '\n')
    echomsg printf('[denops] %s', substitute(line, '\t', '    ', 'g'))
  endfor
  echohl None
endfunction

function! s:on_exit(status, ...) abort dict
  let s:job = v:null
  let s:chan = v:null
  call denops#util#debug(printf('Server stopped: %s', a:status))
  doautocmd <nomodeline> User DenopsStopped
  if s:stopped_on_purpose || v:dying || v:exiting || s:vim_exiting
    return
  endif
  " Restart asynchronously to avoid #136
  call timer_start(g:denops#server#restart_delay, { -> s:restart(a:status) })
endfunction

function! s:stop(restart) abort
  let s:stopped_on_purpose = a:restart ? 0 : 1
  call denops#job#stop(s:job)
endfunction

function! s:restart(status) abort
  if s:restart_guard()
    return
  endif
  call denops#util#warn(printf(
        \ 'Server stopped (%d). Restarting...',
        \ a:status,
        \))
  call denops#server#start()
  call denops#util#info('Server is restarted.')
endfunction

function! s:restart_guard() abort
  let s:restart_count = get(s:, 'restart_count', 0) + 1
  if s:restart_count >= g:denops#server#restart_threshold
    call denops#util#warn(printf(
          \ 'Server stopped %d times within %d millisec. Denops become disabled to avoid infinity restart loop.',
          \ g:denops#server#restart_threshold,
          \ g:denops#server#restart_interval,
          \))
    let g:denops#disabled = 1
    return 1
  endif
  if exists('s:reset_restart_count_delayer')
    call timer_stop(s:reset_restart_count_delayer)
  endif
  let s:reset_restart_count_delayer = timer_start(
        \ g:denops#server#restart_interval,
        \ { -> extend(s:, { 'restart_count': 0 }) },
        \)
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
          \ 'timeout': 1000 * 60 * 60 * 24 * 7,
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

let g:denops#server#deno = get(g:, 'denops#server#deno', g:denops#deno)
let g:denops#server#deno_args = get(g:, 'denops#server#deno_args', filter([
      \ '-q',
      \ g:denops#type_check ? '' : '--no-check',
      \ '--unstable',
      \ '-A',
      \], { _, v -> !empty(v) }))
let g:denops#server#restart_delay = get(g:, 'denops#server#restart_delay', 100)
let g:denops#server#restart_interval = get(g:, 'denops#server#restart_interval', 10000)
let g:denops#server#restart_threshold = get(g:, 'denops#server#restart_threshold', 3)
