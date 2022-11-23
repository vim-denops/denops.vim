let s:loaded_plugins = {}
let s:load_callbacks = {}

function! denops#plugin#is_loaded(plugin) abort
  return has_key(s:loaded_plugins, a:plugin)
endfunction

function! denops#plugin#wait(plugin, ...) abort
  let l:options = extend({
        \ 'interval': g:denops#plugin#wait_interval,
        \ 'timeout': g:denops#plugin#wait_timeout,
        \ 'silent': 0,
        \}, a:0 ? a:1 : {},
        \)
  if denops#server#status() ==# 'stopped'
    if !l:options.silent
      call denops#_internal#echo#error(printf(
            \ 'Failed to wait for "%s" to start. Denops server itself is not started.',
            \ a:plugin,
            \))
    endif
    return -2
  endif
  if has_key(s:loaded_plugins, a:plugin)
    return s:loaded_plugins[a:plugin]
  endif
  let l:ret = denops#_internal#wait#for(
        \ l:options.timeout,
        \ { -> has_key(s:loaded_plugins, a:plugin) },
        \ l:options.interval,
        \)
  if l:ret is# -1
    if !l:options.silent
      call denops#_internal#echo#error(printf(
            \ 'Failed to wait for "%s" to start. It took more than %d milliseconds and timed out.',
            \ a:plugin,
            \ l:options.timeout,
            \))
    endif
    return -1
  endif
endfunction

function! denops#plugin#wait_async(plugin, callback) abort
  if has_key(s:loaded_plugins, a:plugin)
    if s:loaded_plugins[a:plugin] isnot# 0
      return
    endif
    " Some features behave differently in functions invoked from timer_start()
    " so use it even for immediate execution to keep consistent behavior.
    call timer_start(0, { -> a:callback() })
    return
  endif
  let l:callbacks = get(s:load_callbacks, a:plugin, [])
  call add(l:callbacks, a:callback)
  let s:load_callbacks[a:plugin] = l:callbacks
endfunction

function! denops#plugin#register(plugin, ...) abort
  if a:0 is# 0 || type(a:1) is# v:t_dict
    let l:options = a:0 > 0 ? a:1 : {}
    let l:script = s:find_plugin(a:plugin)
  else
    let l:script = a:1
    let l:options = a:0 > 1 ? a:2 : {}
  endif
  let l:meta = denops#_internal#meta#get()
  let l:options = s:options(l:options, {
        \ 'mode': 'error',
        \})
  return s:register(a:plugin, l:script, l:meta, l:options)
endfunction

function! denops#plugin#discover(...) abort
  let l:meta = denops#_internal#meta#get()
  let l:options = s:options(a:0 > 0 ? a:1 : {}, {
        \ 'mode': 'skip',
        \})
  let l:plugins = {}
  call s:gather_plugins(l:plugins)
  call denops#_internal#echo#debug(printf('%d plugins are discovered', len(l:plugins)))
  for [l:plugin, l:script] in items(l:plugins)
    call s:register(l:plugin, l:script, l:meta, l:options)
  endfor
endfunction

function! s:gather_plugins(plugins) abort
  for l:script in globpath(&runtimepath, denops#_internal#path#join(['denops', '*', 'main.ts']), 1, 1, 1)
    let l:plugin = fnamemodify(l:script, ':h:t')
    if l:plugin[:0] ==# '@' || has_key(a:plugins, l:plugin)
      continue
    endif
    call extend(a:plugins, { l:plugin : l:script })
  endfor
endfunction

function! s:options(base, default) abort
  let l:options = extend(a:default, a:base)
  if l:options.mode !~# '^\(reload\|skip\|error\)$'
    throw printf('Unknown mode "%s" is specified', l:options.mode)
  endif
  return l:options
endfunction

function! s:register(plugin, script, meta, options) abort
  let l:script = denops#_internal#path#norm(a:script)
  let l:args = [a:plugin, l:script, a:meta, a:options]
  call denops#_internal#echo#debug(printf('register plugin: %s', l:args))
  return denops#server#request('invoke', ['register', l:args])
endfunction

function! s:find_plugin(plugin) abort
  for l:script in globpath(&runtimepath, denops#_internal#path#join(['denops', a:plugin, 'main.ts']), 1, 1, 1)
    let l:plugin = fnamemodify(l:script, ':h:t')
    if l:plugin[:0] ==# '@' || !filereadable(l:script)
      continue
    endif
    return l:script
  endfor
  throw printf('No denops plugin for "%s" exists', a:plugin)
endfunction

function! s:DenopsPluginPost() abort
  let l:plugin = matchstr(expand('<amatch>'), 'DenopsPluginPost:\zs.*')
  let s:loaded_plugins[l:plugin] = 0
  if !has_key(s:load_callbacks, l:plugin)
    return
  endif
  let l:callbacks = remove(s:load_callbacks, l:plugin)
  " Vim uses FILO for a task execution registered by timer_start().
  " That's why reverse 'callbacks' in the case of Vim to keep consistent
  " behavior.
  let l:callbacks = has('nvim') ? l:callbacks : reverse(l:callbacks)
  for l:Callback in l:callbacks
    call timer_start(0, { -> l:Callback() })
  endfor
endfunction

function! s:DenopsPluginFail() abort
  let l:plugin = matchstr(expand('<amatch>'), 'DenopsPluginFail:\zs.*')
  let s:loaded_plugins[l:plugin] = -3
  if !has_key(s:load_callbacks, l:plugin)
    return
  endif
  call remove(s:load_callbacks, l:plugin)
endfunction

augroup denops_autoload_plugin_internal
  autocmd!
  autocmd User DenopsPluginPost:* call s:DenopsPluginPost()
  autocmd User DenopsPluginFail:* call s:DenopsPluginFail()
  autocmd User DenopsStopped let s:loaded_plugins = {}
augroup END

let g:denops#plugin#wait_interval = get(g:, 'denops#plugin#wait_interval', 10)
let g:denops#plugin#wait_timeout = get(g:, 'denops#plugin#wait_timeout', 30000)
