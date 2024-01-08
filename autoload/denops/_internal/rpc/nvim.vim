function! denops#_internal#rpc#nvim#connect(addr, ...) abort
  let l:options = extend({
        \ 'on_close': { -> 0 },
        \}, a:0 ? a:1 : {},
        \)
  let l:id = sockconnect('tcp', a:addr, {
        \ 'rpc': v:true,
        \})
  if l:id is# 0
    throw printf('Failed to connect `%s`', a:addr)
  endif
  let l:chan = {
        \ '_id': l:id,
        \ '_on_close': l:options.on_close,
        \}
  call luaeval('require("denops")._set_channel(_A[1])', [l:id])
  let l:chan._healthcheck_timer = timer_start(
        \ g:denops#_internal#rpc#nvim#healthcheck_interval,
        \ funcref('s:healthcheck', [l:chan]),
        \ { 'repeat': -1 },
        \)
  return l:chan
endfunction

function! denops#_internal#rpc#nvim#close(chan) abort
  call timer_stop(a:chan._healthcheck_timer)
  call chanclose(a:chan._id)
  call a:chan._on_close(a:chan)
endfunction

function! denops#_internal#rpc#nvim#notify(chan, method, params) abort
  return call('rpcnotify', [a:chan._id, a:method] + a:params)
endfunction

function! denops#_internal#rpc#nvim#request(chan, method, params) abort
  return call('rpcrequest', [a:chan._id, a:method] + a:params)
endfunction

" NOTE:
" Neovim does not provide 'on_close' like callback so we need to check if the
" channel is alive by frequent pseudo RPC requests.
" https://github.com/neovim/neovim/issues/21164
function! s:healthcheck(chan, timer) abort
  try
    call rpcnotify(a:chan._id, 'void')
  catch
    call timer_stop(a:chan._healthcheck_timer)
    call a:chan._on_close(a:chan)
  endtry
endfunction

call denops#_internal#conf#define('denops#_internal#rpc#nvim#healthcheck_interval', 100)
