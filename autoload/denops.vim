let s:server = v:null

function! denops#start() abort
  if s:server isnot# v:null
    throw printf('[denops] The server is already running')
  endif
  let s:server = denops#server#nvim#start(
        \ g:denops#deno_exec,
        \ g:denops#deno_args,
        \)
endfunction

function! denops#notify(method, ...) abort
  if s:server is# v:null
    throw printf('[denops] The server is not started yet')
  endif
  return denops#server#nvim#notify(s:server, a:method, a:000)
endfunction

function! denops#request(method, ...) abort
  if s:server is# v:null
    throw printf('[denops] The server is not started yet')
  endif
  return denops#server#nvim#request(s:server, a:method, a:000)
endfunction

let g:denops#deno_exec = get(g:, 'denops#deno_exec', exepath('deno'))
let g:denops#deno_args = get(g:, 'denops#deno_args', ['-A', '--unstable'])
