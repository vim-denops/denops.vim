const s:STATUS_STOPPED = 'stopped'
const s:STATUS_STARTING = 'starting'
const s:STATUS_PREPARING = 'preparing'
const s:STATUS_RUNNING = 'running'
const s:STATUS_CLOSING = 'closing'
const s:STATUS_CLOSED = 'closed'

let s:is_ready = v:false
let s:ready_callbacks = []

let s:stopping = v:false
let s:restart_once = v:false
let s:local_addr = ""

let s:is_closed = v:false
let s:closing = v:false
let s:reconnect_once = v:false
let s:addr = ""

" Local server
function! denops#server#start() abort
  if g:denops#disabled
    return
  endif
  if s:stopping
    let s:restart_once = v:true
    return
  endif
  if denops#_internal#server#proc#is_started()
    return
  endif
  if denops#_internal#server#chan#is_connected()
    call denops#_internal#echo#warn(printf(
          \ 'Not starting local server, already connected to (%s).',
          \ s:addr,
          \))
    return
  endif
  return denops#_internal#server#proc#start({
        \ 'restart_on_exit': v:true,
        \ 'restart_delay': g:denops#server#restart_delay,
        \ 'restart_interval': g:denops#server#restart_interval,
        \ 'restart_threshold': g:denops#server#restart_threshold,
        \})
endfunction

function! denops#server#stop() abort
  let s:restart_once = v:false
  if s:stopping || !denops#_internal#server#proc#is_started()
    return
  endif
  let s:stopping = v:true
  if s:is_connected_to_local_server()
    if !s:closing
      call s:disconnect()
    endif
    return
  endif
  call s:force_stop()
endfunction

function! denops#server#restart() abort
  call denops#server#stop()
  call denops#server#start()
endfunction

function! s:force_stop() abort
  call denops#_internal#server#proc#stop()
endfunction

function! s:is_connected_to_local_server() abort
  return denops#_internal#server#chan#is_connected() && s:addr ==# s:local_addr
endfunction

" Shared server
function! denops#server#connect() abort
  if g:denops#disabled
    return
  endif
  if s:closing
    let s:addr = s:get_server_addr()
    if !empty(s:addr)
      let s:reconnect_once = v:true
    endif
    return
  endif
  if denops#_internal#server#chan#is_connected()
    return
  endif
  let s:addr = s:get_server_addr()
  if empty(s:addr)
    return
  endif
  return s:connect(s:addr, { 'reconnect_on_close': v:true })
endfunction

function! denops#server#close() abort
  let s:reconnect_once = v:false
  if s:closing || !denops#_internal#server#chan#is_connected()
    return
  endif
  call s:disconnect()
endfunction

function! denops#server#reconnect() abort
  call denops#server#close()
  call denops#server#connect()
endfunction

function! s:get_server_addr() abort
  let l:addr = get(g:, 'denops_server_addr')
  if empty(l:addr)
    call denops#_internal#echo#error(
          \ 'denops shared server address (g:denops_server_addr) is not given',
          \)
  endif
  return l:addr
endfunction

" Common
function! denops#server#status() abort
  if s:closing
    return s:STATUS_CLOSING
  elseif denops#_internal#server#chan#is_connected()
    return s:is_ready ? s:STATUS_RUNNING : s:STATUS_PREPARING
  elseif denops#_internal#server#proc#is_started()
    return s:is_closed ? s:STATUS_CLOSED : s:STATUS_STARTING
  elseif s:stopping
    return s:STATUS_CLOSED
  endif
  return s:STATUS_STOPPED
endfunction

function! denops#server#wait(...) abort
  let l:options = extend({
        \ 'interval': g:denops#server#wait_interval,
        \ 'timeout': g:denops#server#wait_timeout,
        \ 'silent': 0,
        \}, a:0 ? a:1 : {},
        \)
  if denops#server#status() ==# 'stopped'
    if !l:options.silent
      call denops#_internal#echo#error(
            \ 'Failed to wait `DenopsReady` autocmd. Denops server itself is not started.',
            \)
    endif
    return -2
  endif
  if s:is_ready
    return v:true
  endif
  let l:ret = denops#_internal#wait#for(
        \ l:options.timeout,
        \ { -> s:is_ready },
        \ l:options.interval,
        \)
  if l:ret is# -1
    if !l:options.silent
      call denops#_internal#echo#error(printf(
            \ 'Failed to wait `DenopsReady` autocmd. It took more than %d milliseconds and timed out.',
            \ l:options.timeout,
            \))
    endif
    return -1
  endif
endfunction

function! denops#server#wait_async(callback) abort
  if s:is_ready
    call a:callback()
    return
  endif
  call add(s:ready_callbacks, a:callback)
endfunction

function! s:connect(addr, ...) abort
  let s:is_closed = v:false
  let l:options = extend({
        \ 'retry_interval': g:denops#server#retry_interval,
        \ 'retry_threshold': g:denops#server#retry_threshold,
        \ 'reconnect_delay': g:denops#server#reconnect_delay,
        \ 'reconnect_interval': g:denops#server#reconnect_interval,
        \ 'reconnect_threshold': g:denops#server#reconnect_threshold,
        \}, a:0 ? a:1 : {})
  return denops#_internal#server#chan#connect(a:addr, l:options)
endfunction

function! s:disconnect(...) abort
  let s:closing = v:true
  let l:options = extend({
        \ 'timeout': g:denops#server#close_timeout,
        \}, a:0 ? a:1 : {})
  call denops#_internal#server#chan#close(l:options)
endfunction

function! s:DenopsSystemProcessStarted() abort
  doautocmd <nomodeline> User DenopsProcessStarted
endfunction

function! s:DenopsSystemProcessListen(expr) abort
  let s:addr = matchstr(a:expr, '\<DenopsSystemProcessListen:\zs.*')
  let s:local_addr = s:addr
  call s:connect(s:addr, { 'reconnect_on_close': v:false })
endfunction

function! s:DenopsSystemReady() abort
  let s:is_ready = v:true
  let l:callbacks = s:ready_callbacks
  let s:ready_callbacks = []
  try
    for l:Callback in l:callbacks
      call l:Callback()
    endfor
  finally
    doautocmd <nomodeline> User DenopsReady
  endtry
endfunction

function! s:DenopsSystemClosed() abort
  let s:closing = v:false
  let s:is_ready = v:false
  if denops#_internal#server#proc#is_started()
    let s:is_closed = v:true
  endif
  try
    " Shared server
    if s:reconnect_once
      let s:reconnect_once = v:false
      call s:connect(s:addr, { 'reconnect_on_close': v:true })
      return
    endif
    let s:addr = ""
    " Local server
    if s:stopping && denops#_internal#server#proc#is_started()
      call s:force_stop()
    endif
    let s:local_addr = ""
  finally
    doautocmd <nomodeline> User DenopsClosed
  endtry
endfunction

function! s:DenopsSystemProcessStopped(expr) abort
  let l:status = matchstr(a:expr, '\<DenopsSystemProcessStopped:\zs.*')
  let s:stopping = v:false
  let s:is_closed = v:false
  try
    " Local server
    if s:restart_once
      let s:restart_once = v:false
      call denops#server#start()
    endif
  finally
    execute printf(
          \ 'doautocmd <nomodeline> User DenopsProcessStopped:%s',
          \ l:status,
          \)
  endtry
endfunction

augroup denops_server_internal
  autocmd!
  autocmd User DenopsReady :
  autocmd User DenopsClosed :
  autocmd User DenopsProcessStarted :
  autocmd User DenopsProcessStopped:* :
  autocmd User DenopsSystemProcessStarted ++nested call s:DenopsSystemProcessStarted()
  autocmd User DenopsSystemProcessListen:* ++nested call s:DenopsSystemProcessListen(expand('<amatch>'))
  autocmd User DenopsSystemReady ++nested call s:DenopsSystemReady()
  autocmd User DenopsSystemClosed ++nested call s:DenopsSystemClosed()
  autocmd User DenopsSystemProcessStopped:* ++nested call s:DenopsSystemProcessStopped(expand('<amatch>'))
augroup END

call denops#_internal#conf#define('denops#server#deno', g:denops#deno)
call denops#_internal#conf#define('denops#server#deno_args', [
      \ '-q',
      \ '--no-lock',
      \ '-A',
      \])

call denops#_internal#conf#define('denops#server#retry_interval', 500)
call denops#_internal#conf#define('denops#server#retry_threshold', 3)

call denops#_internal#conf#define('denops#server#restart_delay', 100)
call denops#_internal#conf#define('denops#server#restart_interval', 10000)
call denops#_internal#conf#define('denops#server#restart_threshold', 3)

call denops#_internal#conf#define('denops#server#reconnect_delay', 100)
call denops#_internal#conf#define('denops#server#reconnect_interval', 1000)
call denops#_internal#conf#define('denops#server#reconnect_threshold', 3)

call denops#_internal#conf#define('denops#server#close_timeout', 5000)

call denops#_internal#conf#define('denops#server#wait_interval', 200)
call denops#_internal#conf#define('denops#server#wait_timeout', 30000)
