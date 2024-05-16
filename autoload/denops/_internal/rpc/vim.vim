function! denops#_internal#rpc#vim#connect(addr, ...) abort
  let l:options = extend({
        \ 'on_close': { -> 0 },
        \}, a:0 ? a:1 : {},
        \)
  let l:chan = {
        \ '_on_close': l:options.on_close,
        \}
  let l:chan._handle = ch_open(a:addr, {
        \ 'mode': 'json',
        \ 'drop': 'auto',
        \ 'noblock': 1,
        \ 'timeout': g:denops#_internal#rpc#vim#timeout,
        \ 'close_cb': { -> l:chan._on_close(l:chan) },
        \})
  if ch_status(l:chan._handle) !=# 'open'
    throw printf('Failed to connect `%s`', a:addr)
  endif
  return l:chan
endfunction

function! denops#_internal#rpc#vim#close(chan) abort
  " NOTE: 'close_cb' specified on `ch_open` is not invoked when `ch_close` called.
  call ch_close(a:chan._handle)
  call timer_start(0, { -> a:chan._on_close(a:chan) })
endfunction

function! denops#_internal#rpc#vim#notify(chan, method, params) abort
  return ch_sendraw(a:chan._handle, json_encode([0, [a:method] + a:params]) . "\n")
endfunction

function! denops#_internal#rpc#vim#request(chan, method, params) abort
  let [l:ok, l:err] = ch_evalexpr(a:chan._handle, [a:method] + a:params)
  if l:err isnot# v:null
    throw l:err
  endif
  return l:ok
endfunction

call denops#_internal#conf#define('denops#_internal#rpc#vim#timeout', 1000 * 60 * 60 * 24 * 7)
