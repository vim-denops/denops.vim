let s:script = denops#util#script_path('@denops-private', 'service', 'cli.ts')
let s:engine = has('nvim') ? 'nvim' : 'vim'
let s:vim_exiting = 0
let s:stopped_by_user = 0
let s:job = v:null

function! denops#server#service#start(address) abort
  let args = [g:denops#server#service#deno, 'run']
  let args += g:denops#server#service#deno_args
  let args += [
        \ s:script,
        \ '--mode=' . s:engine,
        \ '--address=' . a:address,
        \]
  if g:denops#trace
    let args += ['--trace']
  endif
  let raw_options = has('nvim')
        \ ? {}
        \ : { 'mode': 'nl' }
  let s:stopped_by_user = 0
  let s:job = denops#util#jobstart(args, {
        \ 'env': {
        \   'NO_COLOR': 1,
        \ },
        \ 'on_stdout': funcref('s:on_stdout'),
        \ 'on_stderr': funcref('s:on_stderr'),
        \ 'on_exit': funcref('s:on_exit'),
        \ 'raw_options': raw_options,
        \})
  call denops#util#debug(printf('service server started: %s', args))
  doautocmd <nomodeline> User DenopsServiceStarted
endfunction

function! denops#server#service#stop() abort
  if s:job isnot# v:null
    let s:stopped_by_user = 1
    call denops#util#jobstop(s:job)
  endif
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
  call denops#util#debug(printf('service server stopped: %s', a:status))
  doautocmd <nomodeline> User DenopsServiceStopped
  if s:stopped_by_user || v:dying || s:vim_exiting || a:status is# 143
    return
  endif
  call denops#util#error(printf(
        \ 'service server terminated unexpectedly: %d',
        \ a:status,
        \))
endfunction

augroup denops_server_service_internal
  autocmd!
  autocmd User DenopsServiceStarted :
  autocmd User DenopsServiceStopped :
  autocmd VimLeave * let s:vim_exiting = 1
augroup END

let g:denops#server#service#deno = get(g:, 'denops#server#service#deno', g:denops#deno)
let g:denops#server#service#deno_args = get(g:, 'denops#server#service#deno_args', filter([
      \ '-q',
      \ g:denops#debug ? '' : '--no-check',
      \ '--unstable',
      \ '-A',
      \], { _, v -> !empty(v) }))
