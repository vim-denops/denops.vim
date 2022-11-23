let s:script = denops#util#script_path('@denops-private', 'cli.ts')
let s:engine = has('nvim') ? 'nvim' : 'vim'
let s:vim_exiting = 0
let s:stopped_on_purpose = 0
let s:job = v:null
let s:chan = v:null
let s:STATUS_STOPPED = 'stopped'
let s:STATUS_STARTING = 'starting'
let s:STATUS_RUNNING = 'running'

function! denops#server#connect() abort
  if g:denops#disabled
    return
  endif
  let l:addr = get(g:, 'denops_server_addr')
  if empty(l:addr)
    call denops#_internal#echo#error('denops shared server address (g:denops_server_addr) is not given')
    return
  endif
  return s:connect(l:addr)
endfunction

function! denops#server#start() abort
  if g:denops#disabled
    return
  elseif denops#server#status() isnot# s:STATUS_STOPPED
    call denops#_internal#echo#debug('Server is already starting or running. Skip')
    return
  endif
  let l:args = [g:denops#server#deno, 'run']
  let l:args += g:denops#server#deno_args
  let l:args += [
        \ s:script,
        \ '--quiet',
        \ '--identity',
        \ '--port', '0',
        \]
  if g:denops#trace
    let l:args += ['--trace']
  endif
  let l:raw_options = has('nvim')
        \ ? {}
        \ : { 'mode': 'nl' }
  let s:stopped_on_purpose = 0
  let s:chan = v:null
  let s:job = denops#_internal#job#start(l:args, {
        \ 'env': {
        \   'NO_COLOR': 1,
        \   'DENO_NO_PROMPT': 1,
        \ },
        \ 'on_stdout': funcref('s:on_stdout'),
        \ 'on_stderr': funcref('s:on_stderr'),
        \ 'on_exit': funcref('s:on_exit'),
        \ 'raw_options': l:raw_options,
        \})
  call denops#_internal#echo#debug(printf('Server spawned: %s', l:args))
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
    for l:line in split(a:data, '\n')
      echomsg printf('[denops] %s', substitute(l:line, '\t', '    ', 'g'))
    endfor
    return
  endif
  let l:addr = substitute(a:data, '\r\?\n$', '', 'g')
  if !s:connect(l:addr)
    call denops#server#stop()
    call s:on_stderr(a:data)
    return
  endif
endfunction

function! s:on_stderr(data) abort
  echohl ErrorMsg
  for l:line in split(a:data, '\n')
    echomsg printf('[denops] %s', substitute(l:line, '\t', '    ', 'g'))
  endfor
  echohl None
endfunction

function! s:on_exit(status, ...) abort dict
  let s:job = v:null
  let s:chan = v:null
  call denops#_internal#echo#debug(printf('Server stopped: %s', a:status))
  doautocmd <nomodeline> User DenopsStopped
  if s:stopped_on_purpose || v:dying || v:exiting || s:vim_exiting
    return
  endif
  " Restart asynchronously to avoid #136
  call timer_start(g:denops#server#restart_delay, { -> s:restart(a:status) })
endfunction

function! s:connect(addr) abort
  let l:interval = g:denops#server#reconnect_interval
  let l:threshold = g:denops#server#reconnect_threshold
  let l:previous_exception = ''
  for l:i in range(l:threshold)
    call denops#_internal#echo#debug(printf('Connecting to `%s`', a:addr))
    try
      let s:chan = s:raw_connect(a:addr)
      doautocmd <nomodeline> User DenopsReady
      return v:true
    catch
      call denops#_internal#echo#debug(printf('Failed to connect `%s`: %s', a:addr, v:exception))
      let l:previous_exception = v:exception
    endtry
  endfor
  call denops#_internal#echo#error(printf('Failed to connect `%s`: %s', a:addr, l:previous_exception))
endfunction

function! s:stop(restart) abort
  let s:stopped_on_purpose = a:restart ? 0 : 1
  call denops#_internal#job#stop(s:job)
endfunction

function! s:restart(status) abort
  if s:restart_guard()
    return
  endif
  call denops#_internal#echo#warn(printf(
        \ 'Server stopped (%d). Restarting...',
        \ a:status,
        \))
  call denops#server#start()
  call denops#_internal#echo#info('Server is restarted.')
endfunction

function! s:restart_guard() abort
  let s:restart_count = get(s:, 'restart_count', 0) + 1
  if s:restart_count >= g:denops#server#restart_threshold
    call denops#_internal#echo#warn(printf(
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
  function! s:raw_connect(address) abort
    let l:chan = sockconnect('tcp', a:address, {
          \ 'rpc': v:true,
          \})
    if l:chan is# 0
      throw printf('Failed to connect `%s`', a:address)
    endif
    return l:chan
  endfunction

  function! s:notify(chan, method, params) abort
    return call('rpcnotify', [a:chan, a:method] + a:params)
  endfunction

  function! s:request(chan, method, params) abort
    return call('rpcrequest', [a:chan, a:method] + a:params)
  endfunction
else
  function! s:raw_connect(address) abort
    let l:chan = ch_open(a:address, {
          \ 'mode': 'json',
          \ 'drop': 'auto',
          \ 'noblock': 1,
          \ 'timeout': 1000 * 60 * 60 * 24 * 7,
          \})
    if ch_status(l:chan) !=# 'open'
      throw printf('Failed to connect `%s`', a:address)
    endif
    return l:chan
  endfunction

  function! s:notify(chan, method, params) abort
    return ch_sendraw(a:chan, json_encode([0, [a:method] + a:params]) . "\n")
  endfunction

  function! s:request(chan, method, params) abort
    let [l:ok, l:err] = ch_evalexpr(a:chan, [a:method] + a:params)
    if l:err isnot# v:null
      throw l:err
    endif
    return l:ok
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
let g:denops#server#reconnect_interval = get(g:, 'denops#server#reconnect_interval', 100)
let g:denops#server#reconnect_threshold = get(g:, 'denops#server#reconnect_threshold', 3)
