const s:STATUS_STOPPED = 'stopped'
const s:STATUS_STARTING = 'starting'
const s:STATUS_PREPARING = 'preparing'
const s:STATUS_RUNNING = 'running'

let s:is_ready = v:false
let s:ready_callbacks = []

" Local server
function! denops#server#start() abort
  if g:denops#disabled || denops#_internal#server#proc#is_started()
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
  if !denops#_internal#server#proc#is_started()
    return
  endif
  call denops#_internal#server#proc#stop()
endfunction

function! denops#server#restart() abort
  if denops#_internal#server#proc#is_started()
    call denops#server#stop()
  endif
  call denops#server#start()
endfunction

" Shared server
function! denops#server#connect() abort
  if g:denops#disabled || denops#_internal#server#chan#is_connected()
    return
  endif
  let l:addr = get(g:, 'denops_server_addr')
  if empty(l:addr)
    call denops#_internal#echo#error(
          \ 'denops shared server address (g:denops_server_addr) is not given',
          \)
    return
  endif
  return denops#_internal#server#chan#connect(l:addr, {
        \ 'retry_interval': g:denops#server#retry_interval,
        \ 'retry_threshold': g:denops#server#retry_threshold,
        \ 'reconnect_on_close': v:true,
        \ 'reconnect_delay': g:denops#server#reconnect_delay,
        \ 'reconnect_interval': g:denops#server#reconnect_interval,
        \ 'reconnect_threshold': g:denops#server#reconnect_threshold,
        \})
endfunction

function! denops#server#close() abort
  call denops#_internal#server#chan#close()
endfunction

function! denops#server#reconnect() abort
  if denops#_internal#server#chan#is_connected()
    call denops#server#close()
  endif
  call denops#server#connect()
endfunction

" Common
function! denops#server#status() abort
  if denops#_internal#server#chan#is_connected()
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

function! s:DenopsProcessListen(expr) abort
  let l:addr = matchstr(a:expr, '\<DenopsProcessListen:\zs.*')
  call denops#_internal#server#chan#connect(l:addr, {
        \ 'retry_interval': g:denops#server#retry_interval,
        \ 'retry_threshold': g:denops#server#retry_threshold,
        \ 'reconnect_on_close': v:false,
        \ 'reconnect_delay': g:denops#server#reconnect_delay,
        \ 'reconnect_interval': g:denops#server#reconnect_interval,
        \ 'reconnect_threshold': g:denops#server#reconnect_threshold,
        \})
endfunction

function! s:DenopsReady() abort
  let s:is_ready = v:true
  let l:callbacks = s:ready_callbacks
  let s:ready_callbacks = []
  for l:Callback in l:callbacks
    call l:Callback()
  endfor
endfunction

augroup denops_server_internal
  autocmd!
  autocmd User DenopsProcessListen:* call s:DenopsProcessListen(expand('<amatch>'))
  autocmd User DenopsReady ++nested call s:DenopsReady()
  autocmd User DenopsClosed let s:is_ready = v:false
augroup END

call denops#_internal#conf#define('denops#server#deno_args', [
      \ '-q',
      \ '--no-lock',
      \ '--unstable',
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

call denops#_internal#conf#define('denops#server#wait_interval', 200)
call denops#_internal#conf#define('denops#server#wait_timeout', 30000)
