let s:script = denops#util#script_path('cli', 'service.ts')
let s:engine = has('nvim') ? 'nvim' : 'vim'
let s:vim_exiting = 0
let s:promise = v:null
let s:job = v:null

function! denops#server#service#start(address) abort
  if s:promise isnot# v:null
    return s:promise
  endif
  let args = [g:denops#server#service#deno, 'run']
  let args += g:denops#server#service#deno_args
  let args += [
        \ s:script,
        \ '--mode=' . s:engine,
        \ '--address=' . a:address,
        \]
  let s:promise = denops#lib#promise#new(funcref('s:start', [args]))
  return s:promise
endfunction

function! denops#server#service#restart(address) abort
  if s:promise isnot# v:null
    call denops#server#service#stop()
  endif
  return denops#server#service#start(a:address)
endfunction

function! denops#server#service#stop() abort
  if s:job isnot# v:null
    call denops#lib#job#stop(s:job)
  endif
  let s:promise = v:null
  let s:job = v:null
endfunction

function! s:start(args, resolve, reject) abort
  let raw_options = has('nvim')
        \ ? {}
        \ : { 'mode': 'nl' }
  let s:job = denops#lib#job#start(a:args, {
        \ 'env': {
        \   'NO_COLOR': 1,
        \ },
        \ 'on_stdout': funcref('s:on_stdout'),
        \ 'on_stderr': funcref('s:on_stderr'),
        \ 'on_exit': funcref('s:on_exit'),
        \ 'raw_options': raw_options,
        \})
  call denops#debug(printf("service server start: %s", a:args))
  call a:resolve()
endfunction

function! s:on_stdout(data) abort
  for line in split(a:data, '\n')
    echomsg printf('[denops] %s', line)
  endfor
endfunction

function! s:on_stderr(data) abort
  echohl ErrorMsg
  for line in split(a:data, '\n')
    echomsg printf('[denops] %s', line)
  endfor
  echohl None
endfunction

function! s:on_exit(status, ...) abort dict
  if v:dying || s:vim_exiting || a:status is# 143
    return
  endif
  call denops#error(printf(
        \ 'service server terminated unexpectedly: %d',
        \ a:status,
        \))
endfunction

augroup denops_server_service_internal
  autocmd!
  autocmd VimLeave * let s:vim_exiting = 1
augroup END

let g:denops#server#service#deno = get(g:, 'denops#server#service#deno', g:denops#deno)
let g:denops#server#service#deno_args = get(g:, 'denops#server#service#deno_args', [
      \ '-q',
      \ '--no-check',
      \ '--unstable',
      \ '-A',
      \])
