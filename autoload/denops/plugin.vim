let s:loaded_plugins = {}
let s:load_callbacks = {}

function! denops#plugin#is_loaded(plugin) abort
  return has_key(s:loaded_plugins, a:plugin)
endfunction

function! denops#plugin#wait(plugin, ...) abort
  let options = extend({
        \ 'interval': g:denops#plugin#wait_interval,
        \ 'timeout': g:denops#plugin#wait_timeout,
        \ 'silent': 0,
        \}, a:0 ? a:1 : {},
        \)
  if denops#server#status() ==# 'stopped'
    if !options.silent
      call denops#util#error(printf(
            \ 'Failed to wait for "%s" to start. Denops server itself is not started.',
            \ a:plugin,
            \))
    endif
    return -2
  endif
  if has_key(s:loaded_plugins, a:plugin)
    return s:loaded_plugins[a:plugin]
  endif
  let ret = denops#util#wait(
        \ options.timeout,
        \ { -> has_key(s:loaded_plugins, a:plugin) },
        \ options.interval,
        \)
  if ret is# -1
    if !options.silent
      call denops#util#error(printf(
            \ 'Failed to wait for "%s" to start. It took more than %d milliseconds and timed out.',
            \ a:plugin,
            \ options.timeout,
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
  let callbacks = get(s:load_callbacks, a:plugin, [])
  call add(callbacks, a:callback)
  let s:load_callbacks[a:plugin] = callbacks
endfunction

function! denops#plugin#register(plugin, ...) abort
  if a:0 is# 0 || type(a:1) is# v:t_dict
    let options = a:0 > 0 ? a:1 : {}
    let script = s:find_plugin(a:plugin)
  else
    let script = a:1
    let options = a:0 > 1 ? a:2 : {}
  endif
  let meta = denops#util#meta()
  let options = s:options(options, {
        \ 'mode': 'error',
        \})
  return s:register(a:plugin, script, meta, options)
endfunction

function! denops#plugin#discover(...) abort
  let meta = denops#util#meta()
  let options = s:options(a:0 > 0 ? a:1 : {}, {
        \ 'mode': 'skip',
        \})
  let plugins = {}
  call s:gather_plugins(plugins)
  call denops#util#debug(printf('%d plugins are discovered', len(plugins)))
  for [plugin, script] in items(plugins)
    call s:register(plugin, script, meta, options)
  endfor
endfunction

function! s:gather_plugins(plugins) abort
  for script in globpath(&runtimepath, denops#util#join_path('denops', '*', 'main.ts'), 1, 1, 1)
    let plugin = fnamemodify(script, ':h:t')
    if plugin[:0] ==# '@' || has_key(a:plugins, plugin)
      continue
    endif
    call extend(a:plugins, { plugin : script })
  endfor
endfunction

function! s:options(base, default) abort
  let options = extend(a:default, a:base)
  if options.mode !~# '^\(reload\|skip\|error\)$'
    throw printf('Unknown mode "%s" is specified', options.mode)
  endif
  return options
endfunction

function! s:register(plugin, script, meta, options) abort
  let script = denops#util#normalize_path(a:script)
  let args = [a:plugin, script, a:meta, a:options]
  call denops#util#debug(printf('register plugin: %s', args))
  return denops#server#request('invoke', ['register', args])
endfunction

function! s:find_plugin(plugin) abort
  for script in globpath(&runtimepath, denops#util#join_path('denops', a:plugin, 'main.ts'), 1, 1, 1)
    let plugin = fnamemodify(script, ':h:t')
    if plugin[:0] ==# '@' || !filereadable(script)
      continue
    endif
    return script
  endfor
  throw printf('No denops plugin for "%s" exists', a:plugin)
endfunction

function! s:DenopsPluginPost() abort
  let plugin = matchstr(expand('<amatch>'), 'DenopsPluginPost:\zs.*')
  let s:loaded_plugins[plugin] = 0
  if !has_key(s:load_callbacks, plugin)
    return
  endif
  let callbacks = remove(s:load_callbacks, plugin)
  " Vim uses FILO for a task execution registered by timer_start().
  " That's why reverse 'callbacks' in the case of Vim to keep consistent
  " behavior.
  let callbacks = has('nvim') ? callbacks : reverse(callbacks)
  for l:Callback in callbacks
    call timer_start(0, { -> l:Callback() })
  endfor
endfunction

function! s:DenopsPluginFail() abort
  let plugin = matchstr(expand('<amatch>'), 'DenopsPluginFail:\zs.*')
  let s:loaded_plugins[plugin] = -3
  if !has_key(s:load_callbacks, plugin)
    return
  endif
  call remove(s:load_callbacks, plugin)
endfunction

augroup denops_autoload_plugin_internal
  autocmd!
  autocmd User DenopsPluginPost:* call s:DenopsPluginPost()
  autocmd User DenopsPluginFail:* call s:DenopsPluginFail()
  autocmd User DenopsStopped let s:loaded_plugins = {}
augroup END

let g:denops#plugin#wait_interval = get(g:, 'denops#plugin#wait_interval', 10)
let g:denops#plugin#wait_timeout = get(g:, 'denops#plugin#wait_timeout', 30000)
