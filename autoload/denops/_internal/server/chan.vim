const s:HOST = has('nvim') ? 'nvim' : 'vim'
const s:rpcconnect = function(printf('denops#_internal#rpc#%s#connect', s:HOST))
const s:rpcclose = function(printf('denops#_internal#rpc#%s#close', s:HOST))
const s:rpcnotify = function(printf('denops#_internal#rpc#%s#notify', s:HOST))
const s:rpcrequest = function(printf('denops#_internal#rpc#%s#request', s:HOST))

let s:chan = v:null
let s:addr = v:null
let s:closed_on_purpose = 0
let s:exiting = 0

" Args:
"   addr: string
"   options: {
"     retry_interval: number
"     retry_threshold: number
"     reconnect_on_close: boolean
"     reconnect_delay: number
"     reconnect_interval: number
"     reconnect_threshold: number
"   }
" Return:
"   boolean
function! denops#_internal#server#chan#connect(addr, options) abort
  if s:chan isnot# v:null
    throw '[denops] Channel already exists'
  endif
  let l:retry_threshold = a:options.retry_threshold
  let l:retry_interval = a:options.retry_interval
  let l:i = 1
  while v:true
    call denops#_internal#echo#debug(printf(
          \ 'Connecting to channel `%s` [%d/%d]',
          \ a:addr,
          \ l:i,
          \ l:retry_threshold,
          \))
    try
      call s:connect(a:addr, a:options)
      return v:true
    catch
      call denops#_internal#echo#debug(printf(
            \ 'Failed to connect channel `%s` [%d/%d]: %s',
            \ a:addr,
            \ l:i,
            \ l:retry_threshold,
            \ v:exception,
            \))
      if l:i >= l:retry_threshold
        call denops#_internal#echo#error(printf(
              \ 'Failed to connect channel `%s`: %s',
              \ a:addr,
              \ v:exception,
              \))
        return
      endif
    endtry
    execute printf('sleep %dm', l:retry_interval)
    let l:i += 1
  endwhile
endfunction

" Args:
"   options: {
"     timeout: number (default: 0)
"   }
function! denops#_internal#server#chan#close(options) abort
  if s:chan is# v:null
    throw '[denops] Channel does not exist yet'
  endif
  let l:options = extend({
        \ 'timeout': 0,
        \}, a:options)
  let s:closed_on_purpose = 1
  if l:options.timeout ==# 0
    return s:force_close(l:options)
  endif
  if l:options.timeout > 0
    let s:force_close_delayer = timer_start(
          \ l:options.timeout,
          \ { -> s:force_close(l:options) },
          \)
  endif
  call denops#_internal#server#chan#notify('invoke', ['close', []])
endfunction

function! denops#_internal#server#chan#is_connected() abort
  return s:chan isnot# v:null
endfunction

function! denops#_internal#server#chan#notify(method, params) abort
  if g:denops#disabled
    return
  elseif s:chan is# v:null
    throw '[denops] Channel is not ready yet'
  endif
  return s:rpcnotify(s:chan, a:method, a:params)
endfunction

function! denops#_internal#server#chan#request(method, params) abort
  if g:denops#disabled
    return
  elseif s:chan is# v:null
    throw '[denops] Channel is not ready yet'
  endif
  return s:rpcrequest(s:chan, a:method, a:params)
endfunction

function! s:connect(addr, options) abort
  let s:closed_on_purpose = 0
  let s:addr = a:addr
  let s:chan = s:rpcconnect(a:addr, {
        \ 'on_close': { -> s:on_close(a:options) },
        \})
  call denops#_internal#echo#debug(printf('Channel connected (%s)', a:addr))
  call s:rpcnotify(s:chan, 'void', [])
endfunction

function! s:force_close(options) abort
  let l:chan = s:chan
  let s:chan = v:null
  call s:clear_force_close_delayer()
  call denops#_internal#echo#warn(printf(
        \ 'Channel cannot close gracefully within %d millisec, force close (%s)',
        \ a:options.timeout,
        \ s:addr,
        \))
  call s:rpcclose(l:chan)
endfunction

function! s:clear_force_close_delayer() abort
  if exists('s:force_close_delayer')
    call timer_stop(s:force_close_delayer)
    unlet s:force_close_delayer
  endif
endfunction

function! s:on_close(options) abort
  let s:chan = v:null
  call s:clear_force_close_delayer()
  call denops#_internal#echo#debug(printf('Channel closed (%s)', s:addr))
  doautocmd <nomodeline> User DenopsSystemClosed
  if s:chan isnot# v:null || !a:options.reconnect_on_close || s:closed_on_purpose || s:exiting
    return
  endif
  " Reconnect
  if s:reconnect_guard(a:options)
    return
  endif
  call denops#_internal#echo#warn('Channel closed. Reconnecting...')
  call timer_start(
        \ a:options.reconnect_delay,
        \ { -> denops#_internal#server#chan#connect(s:addr, a:options) },
        \)
endfunction

function! s:reconnect_guard(options) abort
  let l:reconnect_threshold = a:options.reconnect_threshold
  let l:reconnect_interval = a:options.reconnect_interval
  let s:reconnect_count = get(s:, 'reconnect_count', 0) + 1
  if s:reconnect_count >= l:reconnect_threshold
    call denops#_internal#echo#warn(printf(
          \ 'Channel closed %d times within %d millisec. Denops is disabled to avoid infinity reconnect loop.',
          \ l:reconnect_threshold,
          \ l:reconnect_interval,
          \))
    let g:denops#disabled = 1
    return 1
  endif
  if exists('s:reset_reconnect_count_delayer')
    call timer_stop(s:reset_reconnect_count_delayer)
  endif
  let s:reset_reconnect_count_delayer = timer_start(
        \ l:reconnect_interval,
        \ { -> extend(s:, { 'reconnect_count': 0 }) },
        \)
endfunction

augroup denops_internal_server_chan_internal
  autocmd!
  autocmd VimLeave * let s:exiting = 1
  autocmd User DenopsSystemReady :
  autocmd User DenopsSystemClosed :
augroup END
