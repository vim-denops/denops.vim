const s:STATUS_STOPPED = 'stopped'
const s:STATUS_STARTING = 'starting'
const s:STATUS_PREPARING = 'preparing'
const s:STATUS_RUNNING = 'running'
const s:STATUS_CLOSING = 'closing'

let s:is_ready = v:false
let s:ready_callbacks = []

let s:stopping = v:false
let s:force_stopping = v:false
let s:restart_once = v:false
let s:addr = ""

let s:closing = v:false
let s:reconnect_once = v:false

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
        \ || denops#_internal#server#chan#is_connected()
    return
  endif
  return denops#_internal#server#proc#start({
        \ 'retry_interval': g:denops#server#retry_interval,
        \ 'retry_threshold': g:denops#server#retry_threshold,
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
  call s:disconnect()
  if g:denops#server#stop_timeout ==# 0
        \ || !denops#_internal#server#chan#is_connected()
    return s:force_stop()
  endif
endfunction

function! denops#server#restart() abort
  call denops#server#stop()
  call denops#server#start()
endfunction

function! s:force_stop() abort
  let s:force_stopping = v:true
  call denops#_internal#server#proc#stop()
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
        \ || denops#_internal#server#proc#is_started()
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
        \ || denops#_internal#server#proc#is_started()
    return
  endif
  let s:closing = v:true
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
  if s:stopping || s:closing
    return s:STATUS_CLOSING
  elseif denops#_internal#server#chan#is_connected()
    return s:is_ready ? s:STATUS_RUNNING : s:STATUS_PREPARING
  elseif denops#_internal#server#proc#is_started()
    return s:STATUS_STARTING
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
  let options = extend({
        \ 'retry_interval': g:denops#server#retry_interval,
        \ 'retry_threshold': g:denops#server#retry_threshold,
        \ 'reconnect_delay': g:denops#server#reconnect_delay,
        \ 'reconnect_interval': g:denops#server#reconnect_interval,
        \ 'reconnect_threshold': g:denops#server#reconnect_threshold,
        \}, a:0 ? a:1 : {})
  return denops#_internal#server#chan#connect(a:addr, l:options)
endfunction

function! s:disconnect(...) abort
  let options = extend({
        \ 'timeout': g:denops#server#close_timeout,
        \}, a:0 ? a:1 : {})
  call denops#_internal#server#chan#close(l:options)
endfunction

function! s:DenopsProcessListen(expr) abort
  let l:addr = matchstr(a:expr, '\<DenopsProcessListen:\zs.*')
  call s:connect(l:addr, { 'reconnect_on_close': v:false })
endfunction

function! s:DenopsReady() abort
  let s:is_ready = v:true
  let l:callbacks = s:ready_callbacks
  let s:ready_callbacks = []
  for l:Callback in l:callbacks
    call l:Callback()
  endfor
endfunction

function! s:DenopsClosed() abort
  let s:is_ready = v:false
  " Shared server
  let s:closing = v:false
  if s:reconnect_once
    let s:reconnect_once = v:false
    call s:connect(s:addr, { 'reconnect_on_close': v:true })
    return
  endif
  " Local server
  if s:stopping && !s:force_stopping
        \ && denops#_internal#server#proc#is_started()
    call s:force_stop()
  endif
endfunction

function! s:DenopsProcessStopped() abort
  " Local server
  let s:stopping = v:false
  let s:force_stopping = v:false
  if s:restart_once
    let s:restart_once = v:false
    call denops#server#start()
  endif
endfunction

augroup denops_server_internal
  autocmd!
  autocmd User DenopsProcessListen:* call s:DenopsProcessListen(expand('<amatch>'))
  autocmd User DenopsReady ++nested call s:DenopsReady()
  autocmd User DenopsClosed call s:DenopsClosed()
  autocmd User DenopsProcessStopped:* call s:DenopsProcessStopped()
augroup END

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

call denops#_internal#conf#define('denops#server#stop_timeout', 5000)
call denops#_internal#conf#define('denops#server#close_timeout', 5000)

call denops#_internal#conf#define('denops#server#wait_interval', 200)
call denops#_internal#conf#define('denops#server#wait_timeout', 30000)
