let s:sep = has('win32') ? '\' : '/'
let s:root = expand('<sfile>:h:h:h')
let s:vim_exiting = 0
let s:context_map = {}

function! denops#script#path(...) abort
  return join([s:root, 'denops', 'denops'] + a:000, s:sep)
endfunction

function! denops#script#start(name, script, ...) abort
  let options = extend({
        \ 'deno': g:denops#script#deno,
        \ 'deno_args': g:denops#script#deno_args,
        \ 'script_args': [],
        \ 'on_stdout': { -> 0},
        \ 'on_stderr': { -> 0},
        \ 'on_exit': { status, context -> denops#error(context.error) },
        \ 'env': g:denops#script#env,
        \ 'raw_options': {},
        \}, a:0 ? a:1 : {})
  " Validation
  if !executable(options.deno)
    throw printf('deno is not executable: %s', options.deno)
  elseif !filereadable(a:script)
    throw printf('script file is not found: %s', a:script)
  elseif has_key(s:context_map, a:name)
    let error = get(s:context_map, 'error', printf('script is already started', a:name))
    throw printf('%s [%s]', error, a:name)
  endif
  " Construct context
  let args = [remove(options, 'deno'), 'run']
  let args += remove(options, 'deno_args')
  let args += [a:script]
  let args += remove(options, 'script_args')
  let context = {
        \ 'name': a:name,
        \ 'restart_count': 0,
        \ }
  let options.on_exit = funcref(
        \ 's:on_exit_keep_alive',
        \ [options.on_exit, args, options],
        \)
  let s:context_map[a:name] = context
  return s:start(context, args, options)
endfunction

function! s:on_exit_keep_alive(on_exit, args, options, status, context) abort
  if v:dying || s:vim_exiting
    return
  elseif a:status is# 0
    call a:on_exit(a:status, a:context)
    return
  endif
  " Restart the script
  let a:context.restart_count = a:context.restart_count + 1
  if a:context.restart_count >= g:denops#script#max_restart
    let a:context.error = printf(
          \ "Server '%s' terminate too many times\n  exit_code: %d\n  args: %s",
          \ a:context.name,
          \ a:status,
          \ a:args,
          \)
    call a:on_exit(a:status, a:context)
    return
  endif
  call s:start(a:context, a:args, a:options)
endfunction

if has('nvim')
  function! s:start(context, args, options) abort
    let options = extend({
          \ 'on_stdout': funcref('s:on_recv_raw', [a:options.on_stdout, a:context]),
          \ 'on_stderr': funcref('s:on_recv_raw', [a:options.on_stderr, a:context]),
          \ 'on_exit': funcref('s:on_exit_raw', [a:options.on_exit, a:context]),
          \ 'env': a:options.env,
          \}, a:options.raw_options)
    return jobstart(a:args, options)
  endfunction

  function! s:on_recv_raw(callback, context, job, data, event) abort
    call a:callback(join(a:data, "\n"), a:context)
  endfunction

  function! s:on_exit_raw(callback, context, job, status, event) abort
    call a:callback(a:status, a:context)
  endfunction
else
  function! s:start(context, args, options) abort
    let options = extend({
          \ 'noblock': 1,
          \ 'mode': 'nl',
          \ 'out_cb': funcref('s:out_cb', [a:options.on_stdout, a:context]),
          \ 'err_cb': funcref('s:out_cb', [a:options.on_stderr, a:context]),
          \ 'exit_cb': funcref('s:exit_cb', [a:options.on_exit, a:context]),
          \ 'env': a:options.env,
          \}, a:options.raw_options)
    return job_start(a:args, options)
  endfunction

  function! s:out_cb(callback, context, ch, msg) abort
    call a:callback(a:msg, a:context)
  endfunction

  function! s:exit_cb(callback, context, ch, status) abort
    call a:callback(a:status, a:context)
  endfunction
endif

augroup denos_script_internal
  autocmd!
  autocmd VimLeave * ++once let s:vim_exiting = 1
augroup END

let g:denops#script#deno = get(g:, 'denops#script#deno', exepath('deno'))
let g:denops#script#deno_args = get(g:, 'denops#script#deno_args', ['-q', '--unstable', '-A'])
let g:denops#script#env = get(g:, 'denops#script#env', {
      \ 'NO_COLOR': 1,
      \})
let g:denops#script#max_restart = get(g:, 'denops#script#max_restart', 5)
