let s:script = denops#script#path('cli', 'server.ts')
let s:engine = has('nvim') ? 'nvim' : 'vim'
let s:server = v:null
let s:channel = v:null

function! denops#server#notify(method, params) abort
  if s:server is# v:null
    throw printf('The server is not started yet')
  elseif s:channel is# v:null
    throw printf('The server is not ready yet')
  endif
  return s:notify(s:channel.job, a:method, a:params)
endfunction

function! denops#server#request(method, params) abort
  if s:server is# v:null
    throw printf('The server is not started yet')
  elseif s:channel is# v:null
    throw printf('The server is not ready yet')
  endif
  return s:request(s:channel.job, a:method, a:params)
endfunction

function! denops#server#start() abort
  if s:server isnot# v:null
    return s:server
  endif
  let s:server = s:start(s:script, {
        \ 'on_stdout': funcref('s:on_stdout'),
        \ 'on_stderr': funcref('s:on_stderr'),
        \})
  call s:server.then(funcref('s:on_server_ready'))
  return s:server
endfunction

function! s:on_stdout(data, context) abort
  for line in split(a:data, '\n')
    echomsg printf('[denops] %s', line)
  endfor
endfunction

function! s:on_stderr(data, context) abort
  echohl ErrorMsg
  for line in split(a:data, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! s:on_server_ready(channel) abort
  let s:channel = a:channel
  doautocmd <nomodeline> User DenopsReady
endfunction

function! s:on_channel_opened(script, options, channel) abort
  let deno_args = g:denops#script#deno_args
  if g:denops#server#inspecter_enabled
    let deno_args += ['--inspect']
  endif
  call denops#script#start('server', a:script, {
        \ 'deno_args': deno_args,
        \ 'script_args': ['--mode=' . s:engine, '--address=' . a:channel.address],
        \ 'on_stdout': a:options.on_stdout,
        \ 'on_stderr': a:options.on_stderr,
        \})
  return a:channel
endfunction

if has('nvim')
  function! s:notify(job, method, params) abort
    return call('rpcnotify', [a:job, a:method] + a:params)
  endfunction

  function! s:request(job, method, params) abort
    return call('rpcrequest', [a:job, a:method] + a:params)
  endfunction

  function! s:start(script, options) abort
    let raw_options = {
          \ 'rpc': v:true,
          \}
    return denops#channel#start(raw_options)
          \.then({ channel -> s:on_channel_opened(a:script, a:options, channel) })
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

  function! s:start(script, options) abort
    let raw_options = {
          \ 'mode': 'json',
          \ 'err_mode': 'nl',
          \}
    return denops#channel#start(raw_options)
          \.then({ channel -> s:on_channel_opened(a:script, a:options, channel) })
  endfunction
endif

augroup denops_server_internal
  autocmd!
  autocmd User DenopsReady :
augroup END

let g:denops#server#enable_inspector = get(g:, 'denops#server#enable_inspector', 0)
