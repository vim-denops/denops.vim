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
"     reconnect_on_close: boolean
"     reconnect_delay: number
"     reconnect_interval: number
"     reconnect_threshold: number
"     on_connect_failure: funcref
"   }
" Return:
"   v:true - If the connection is successful immediately.
"   0 - Otherwise, if it fails or waits for reconnection.
function! denops#_internal#server#chan#connect(addr, options) abort
  call s:clear_reconnect_delayer()
  if s:chan isnot# v:null
    throw '[denops] Channel already exists'
  endif
  try
    call s:connect(a:addr, a:options)
    return v:true
  catch
    if s:reconnect_guard(a:options)
      call denops#_internal#echo#error(printf(
            \ 'Failed to connect channel `%s`: %s',
            \ a:addr,
            \ v:exception,
            \))
      if a:options->has_key('on_connect_failure')
        call a:options.on_connect_failure(a:options)
      endif
      return
    endif
    call denops#_internal#echo#debug(printf(
          \ 'Failed to connect channel `%s` [%d/%d]: %s',
          \ a:addr,
          \ s:reconnect_count,
          \ a:options.reconnect_threshold,
          \ v:exception,
          \))
    let s:reconnect_delayer = timer_start(
          \ a:options.reconnect_delay,
          \ { -> denops#_internal#server#chan#connect(a:addr, a:options) },
          \)
  endtry
endfunction

" Args:
"   options: {
"     timeout: number (default: 0)
"   }
function! denops#_internal#server#chan#close(options) abort
  if s:clear_reconnect_delayer()
    return
  endif
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
  call denops#_internal#event#emit('DenopsSystemClosed')
  if s:chan isnot# v:null || !a:options.reconnect_on_close || s:closed_on_purpose || s:exiting
    return
  endif
  call s:schedule_reconnect(a:options)
endfunction

function! s:schedule_reconnect(options)
  if s:reconnect_guard(a:options)
    call denops#_internal#echo#warn(printf(
          \ 'Channel closed %d times within %d millisec. Denops is disabled to avoid infinity reconnect loop.',
          \ a:options.reconnect_threshold + 1,
          \ a:options.reconnect_interval
          \))
    let g:denops#disabled = 1
    return
  endif
  call denops#_internal#echo#warn('Channel closed. Reconnecting...')
  let s:reconnect_delayer = timer_start(
        \ a:options.reconnect_delay,
        \ { -> s:reconnect(a:options) },
        \)
endfunction

function! s:reconnect(options) abort
  call denops#_internal#echo#debug(printf(
        \ 'Reconnect channel `%s` [%d/%d]',
        \ s:addr,
        \ s:reconnect_count,
        \ a:options.reconnect_threshold,
        \))
  try
    call s:connect(s:addr, a:options)
  catch /Could not find constraint\|Could not find version of/
    " Show a warning message when Deno module cache issue is detected
    " https://github.com/vim-denops/denops.vim/issues/358
    call denops#_internal#echo#debug(repeat('*', 80))
    call denops#_internal#echo#debug('Deno module cache issue is detected.')
    call denops#_internal#echo#debug(
          \ "Execute 'call denops#cache#update(#{reload: v:true})' and restart Vim/Neovim."
          \ )
    call denops#_internal#echo#debug(
          \ 'See https://github.com/vim-denops/denops.vim/issues/358 for more detail.'
          \ )
    call denops#_internal#echo#debug(repeat('*', 80))
  catch
    call denops#_internal#echo#debug(printf(
          \ 'Failed to reconnect channel `%s` [%d/%d]: %s',
          \ s:addr,
          \ s:reconnect_count,
          \ a:options.reconnect_threshold,
          \ v:exception,
          \))
    call s:schedule_reconnect(a:options)
  endtry
endfunction

function! s:clear_reconnect_delayer() abort
  if exists('s:reconnect_delayer')
    call timer_stop(s:reconnect_delayer)
    unlet s:reconnect_delayer
    return v:true
  endif
endfunction

function! s:reconnect_guard(options) abort
  let l:reconnect_threshold = a:options.reconnect_threshold
  let l:reconnect_interval = a:options.reconnect_interval
  let s:reconnect_count = get(s:, 'reconnect_count', 0) + 1
  if s:reconnect_count > l:reconnect_threshold
    let s:reconnect_count = 0
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
