const s:SCRIPT = denops#_internal#path#script(['@denops-private', 'cli.ts'])
const s:CONFIG = denops#_internal#path#script(['@denops-private', 'deno.jsonc'])

let s:job = v:null
let s:stopped_on_purpose = 0
let s:exiting = 0

" Args:
"   options: {
"     restart_on_exit: boolean
"     restart_delay: number
"     restart_interval: number
"     restart_threshold: number
"   }
" Return:
"   v:true
function! denops#_internal#server#proc#start(options) abort
  call s:clear_restart_delayer()
  if s:job isnot# v:null
    throw '[denops] Server already exists'
  endif
  call denops#_internal#echo#debug(printf(
        \ 'Spawn server [%d/%d]',
        \ get(s:, 'restart_count', 0),
        \ a:options.restart_threshold,
        \))
  call s:start(a:options)
  return v:true
endfunction

function! denops#_internal#server#proc#stop() abort
  if s:clear_restart_delayer()
    return
  endif
  if s:job is# v:null
    throw '[denops] Server does not exist yet'
  endif
  let s:stopped_on_purpose = 1
  call denops#_internal#job#stop(s:job)
  let s:job = v:null
endfunction

function! denops#_internal#server#proc#is_started() abort
  return s:job isnot# v:null
endfunction

function! s:start(options) abort
  let l:args = [g:denops#server#deno, 'run']
  let l:args += g:denops#server#deno_args
  let l:args += [
        \ '--config',
        \ s:CONFIG,
        \ s:SCRIPT,
        \ '--quiet',
        \ '--identity',
        \ '--port', '0',
        \]
  let l:env = {
        \   'NO_COLOR': 1,
        \   'DENO_NO_PROMPT': 1,
        \   'DENO_NO_PACKAGE_JSON': 1,
        \ }
  if g:denops#deno_dir isnot# v:null
    let l:env['DENO_DIR'] = g:denops#deno_dir
  endif
  let l:store = {'prepared': 0}
  let s:stopped_on_purpose = 0
  let s:job = denops#_internal#job#start(l:args, {
        \ 'env': l:env,
        \ 'on_stdout': { _job, data, _event -> s:on_stdout(l:store, data) },
        \ 'on_stderr': { _job, data, _event -> s:on_stderr(data) },
        \ 'on_exit': { _job, status, _event -> s:on_exit(a:options, status) },
        \})
  call denops#_internal#echo#debug(printf('Server started: %s', l:args))
  call denops#_internal#event#emit('DenopsSystemProcessStarted')
endfunction

function! s:on_stdout(store, data) abort
  if a:store.prepared
    for l:line in split(a:data, '\n')
      echomsg printf('[denops] %s', substitute(l:line, '\t', '    ', 'g'))
    endfor
    return
  endif
  let a:store.prepared = 1
  let l:addr = substitute(a:data, '\r\?\n$', '', 'g')
  call denops#_internal#echo#debug(printf('Server listen: %s', l:addr))
  call denops#_internal#event#emit(printf('DenopsSystemProcessListen:%s', l:addr))
endfunction

function! s:on_stderr(data) abort
  echohl ErrorMsg
  for l:line in split(a:data, '\n')
    echomsg printf('[denops] %s', substitute(l:line, '\t', '    ', 'g'))
  endfor
  echohl None
endfunction

function! s:on_exit(options, status) abort
  let s:job = v:null
  call denops#_internal#echo#debug(printf('Server stopped: %s', a:status))
  call denops#_internal#event#emit(printf('DenopsSystemProcessStopped:%s', a:status))
  const l:last_error = execute('20messages')
  if l:last_error =~# 'Could not find constraint\|Could not find version of'
    " Show a warning message when Deno module cache issue is detected
    " https://github.com/vim-denops/denops.vim/issues/358
    call denops#_internal#echo#warn(repeat('*', 80))
    call denops#_internal#echo#warn('Deno module cache issue is detected.')
    call denops#_internal#echo#warn(
          \ "Execute 'call denops#cache#update(#{reload: v:true})' and restart Vim/Neovim."
          \ )
    call denops#_internal#echo#warn(
          \ 'See https://github.com/vim-denops/denops.vim/issues/358 for more detail.'
          \ )
    call denops#_internal#echo#warn(repeat('*', 80))
    return
  endif
  if s:job isnot# v:null || !a:options.restart_on_exit || s:stopped_on_purpose || s:exiting
    return
  endif
  " Restart
  if s:restart_guard(a:options)
    return
  endif
  call denops#_internal#echo#warn(printf(
        \ 'Server stopped (%d). Restarting...',
        \ a:status,
        \))
  let s:restart_delayer = timer_start(
        \ a:options.restart_delay,
        \ { -> denops#_internal#server#proc#start(a:options) },
        \)
endfunction

function! s:restart_guard(options) abort
  let l:restart_threshold = a:options.restart_threshold
  let l:restart_interval = a:options.restart_interval
  let s:restart_count = get(s:, 'restart_count', 0) + 1
  if s:restart_count > l:restart_threshold
    call denops#_internal#echo#warn(printf(
          \ 'Server stopped %d times within %d millisec. Denops is disabled to avoid infinity restart loop.',
          \ s:restart_count,
          \ l:restart_interval,
          \))
    let s:restart_count = 0
    let g:denops#disabled = 1
    return 1
  endif
  if exists('s:reset_restart_count_delayer')
    call timer_stop(s:reset_restart_count_delayer)
  endif
  let s:reset_restart_count_delayer = timer_start(
        \ l:restart_interval,
        \ { -> extend(s:, { 'restart_count': 0 }) },
        \)
endfunction

function! s:clear_restart_delayer() abort
  if exists('s:restart_delayer')
    call timer_stop(s:restart_delayer)
    unlet s:restart_delayer
    return v:true
  endif
endfunction

augroup denops_internal_server_proc_internal
  autocmd!
  autocmd VimLeave * let s:exiting = 1
  autocmd User DenopsSystemProcessStarted :
  autocmd User DenopsSystemProcessListen:* :
  autocmd User DenopsSystemProcessStopped:* :
augroup END

function! denops#_internal#server#proc#_get_job_for_test() abort
  call denops#_internal#echo#warn(
        \ '_get_job_for_test() should only be used for testing.'
        \)
  return s:job
endfunction
