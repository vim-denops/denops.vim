let s:script = denops#util#script_path('cli', 'channel.ts')
let s:vim_exiting = 0
let s:job = v:null

function! denops#server#channel#start(notify) abort
  let ctx = {
        \ 'notified': 0,
        \ 'notify': a:notify,
        \}
  let args = [g:denops#server#channel#deno, 'run']
  let args += g:denops#server#channel#deno_args
  let args += [s:script]
  let raw_options = has('nvim')
        \ ? {'rpc': v:true}
        \ : {'mode': 'json', 'err_mode': 'nl'}
  let s:job = denops#util#jobstart(args, {
        \ 'env': {
        \   'NO_COLOR': 1,
        \ },
        \ 'on_stderr': funcref('s:on_stderr', [ctx]),
        \ 'on_exit': funcref('s:on_exit'),
        \ 'raw_options': raw_options,
        \})
  call denops#util#debug(printf('channel server start: %s', args))
endfunction

function! denops#server#channel#stop() abort
  if s:job isnot# v:null
    call denops#util#jobstop(s:job)
  endif
endfunction

function! denops#server#channel#notify(method, params) abort
  if s:job is# v:null
    throw printf('The channel server is not ready yet')
  endif
  return s:notify(s:job, a:method, a:params)
endfunction

function! denops#server#channel#request(method, params) abort
  if s:job is# v:null
    throw printf('The channel server is not ready yet')
  endif
  return s:request(s:job, a:method, a:params)
endfunction

function! s:on_stderr(ctx, data, ...) abort dict
  if a:ctx.notified
    return
  endif
  let address = substitute(a:data, '[\s\r\n]*$', '', '')
  let a:ctx.notified = 1
  call a:ctx.notify(address)
  call denops#util#debug(printf('channel server resolve: %s', address))
endfunction

function! s:on_exit(status, ...) abort dict
  if v:dying || s:vim_exiting || a:status is# 143
    return
  endif
  call denops#util#error(printf(
        \ 'channel server terminated unexpectedly: %d',
        \ a:status,
        \))
endfunction

if has('nvim')
  function! s:notify(job, method, params) abort
    return call('rpcnotify', [a:job, a:method] + a:params)
  endfunction

  function! s:request(job, method, params) abort
    return call('rpcrequest', [a:job, a:method] + a:params)
  endfunction
else
  function! s:notify(server, method, params) abort
    return ch_sendraw(a:server, json_encode([0, [a:method] + a:params]) . "\n")
  endfunction

  function! s:request(server, method, params) abort
    let [ok, err] = ch_evalexpr(a:server, [a:method] + a:params)
    if err isnot# v:null
      throw err
    endif
    return ok
  endfunction
endif

augroup denops_server_channel_internal
  autocmd!
  autocmd VimLeave * let s:vim_exiting = 1
augroup END

let g:denops#server#channel#deno = get(g:, 'denops#server#channel#deno', g:denops#deno)
let g:denops#server#channel#deno_args = get(g:, 'denops#server#channel#deno_args', [
      \ '-q',
      \ '--no-check',
      \ '--allow-net',
      \])
