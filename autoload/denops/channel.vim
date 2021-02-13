let s:script = denops#script#path('cli', 'channel.ts')
let s:job = v:null
let s:channel = v:null
let s:address = v:null

function! denops#channel#start(raw_options) abort
  if s:channel isnot# v:null
    return s:channel
  endif
  let s:channel = denops#promise#new(funcref('s:start', [a:raw_options]))
  return s:channel
endfunction

function! s:start(raw_options, resolve, reject) abort
  let s:job = denops#script#start('channel', s:script, {
        \ 'raw_options': a:raw_options,
        \ 'on_stderr': funcref('s:on_stderr', [a:resolve]),
        \ 'on_exit': funcref('s:on_exit', [a:reject]),
        \})
endfunction

function! s:on_stderr(resolve, data, ...) abort
  if s:address is# v:null
    let s:address = substitute(a:data, '\s*$', '', '')
    call a:resolve({
          \ 'job': s:job,
          \ 'address': s:address,
          \})
    return
  endif
  call denops#error(printf(
        \ 'Channel server sent unexpected data: %s',
        \ a:data,
        \))
endfunction

function! s:on_exit(reject, status, context) abort
  if s:address is# v:null
    call a:reject(printf(
          \ 'Channel server terminated unexpectedly: %d',
          \ a:status,
          \))
    return
  elseif a:status is# 0
    return
  endif
  let s:channel = v:null
  let s:address = v:null
  call denops#error(get(a:context, 'error', printf(
        \ 'Channel sever terminated unexpectedly: %d',
        \ a:status,
        \)))
endfunction
