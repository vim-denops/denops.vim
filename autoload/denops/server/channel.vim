let s:script = denops#util#script_path('cli', 'channel.ts')
let s:vim_exiting = 0
let s:promise = v:null
let s:job = v:null

function! denops#server#channel#start() abort
  if s:promise isnot# v:null
    return s:promise
  endif
  let args = [g:denops#server#channel#deno, 'run']
  let args += g:denops#server#channel#deno_args
  let args += [s:script]
  let s:promise = denops#lib#promise#new(funcref('s:start', [args]))
  return s:promise
endfunction

function! denops#server#channel#restart() abort
  if s:promise isnot# v:null
    call denops#server#channel#stop()
  endif
  return denops#server#channel#start()
endfunction

function! denops#server#channel#stop() abort
  if s:job isnot# v:null
    call denops#lib#job#stop(s:job)
  endif
  let s:promise = v:null
  let s:job = v:null
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

function! s:start(args, resolve, reject) abort
  let raw_options = has('nvim')
        \ ? {'rpc': v:true}
        \ : {'mode': 'json', 'err_mode': 'nl'}
  let s:job = denops#lib#job#start(a:args, {
        \ 'env': {
        \   'NO_COLOR': 1,
        \ },
        \ 'on_stderr': funcref('s:on_stderr', [a:resolve]),
        \ 'on_exit': funcref('s:on_exit', [a:reject]),
        \ 'raw_options': raw_options,
        \})
  call denops#debug(printf("channel server start: %s", a:args))
endfunction

function! s:on_stderr(resolve, data, ...) abort dict
  let address = substitute(a:data, '[\s\r\n]*$', '', '')
  call a:resolve(address)
  call denops#debug(printf("channel server resolve: %s", address))
endfunction

function! s:on_exit(reject, status, ...) abort dict
  if v:dying || s:vim_exiting || a:status is# 143
    return
  endif
  call a:reject({'exception': 'channel server terminated unexpectedly'})
  call denops#error(printf(
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
