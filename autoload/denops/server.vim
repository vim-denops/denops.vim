let s:server = v:null

function! denops#server#start() abort
  if s:server isnot# v:null
    throw printf('[denops] The server is already running')
  endif
  let s:server = s:start(g:denops#server#deno_exec, g:denops#server#deno_args)
  doautocmd User DenopsReady
endfunction

function! denops#server#notify(method, ...) abort
  if s:server is# v:null
    throw printf('[denops] The server is not started yet')
  endif
  return s:notify(s:server, a:method, a:000)
endfunction

function! denops#server#request(method, ...) abort
  if s:server is# v:null
    throw printf('[denops] The server is not started yet')
  endif
  return s:request(s:server, a:method, a:000)
endfunction

if has('nvim')
  let s:start = function('denops#server#neovim#start')
  let s:notify = function('denops#server#neovim#notify')
  let s:request = function('denops#server#neovim#request')
else
  let s:start = function('denops#server#vim#start')
  let s:notify = function('denops#server#vim#notify')
  let s:request = function('denops#server#vim#request')
endif

augroup denops_autocmd_server_internal
  autocmd!
  autocmd User DenopsReady :
augroup END

let g:denops#server#deno_exec = get(g:, 'denops#server#deno_exec', exepath('deno'))
let g:denops#server#deno_args = get(g:, 'denops#server#deno_args', ['-q', '-A', '--unstable'])
