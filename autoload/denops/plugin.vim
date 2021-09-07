let s:loaded_plugins = {}
let s:load_callbacks = {}

function! denops#plugin#is_loaded(plugin) abort
  return has_key(s:loaded_plugins, a:plugin)
endfunction

function! denops#plugin#wait(plugin, ...) abort
  if has_key(s:loaded_plugins, a:plugin)
    return
  endif
  let options = extend({
        \ 'interval': g:denops#plugin#wait_interval,
        \}, a:0 ? a:1 : {},
        \)
  let expr = printf('sleep %dm', options.interval)
  while !has_key(s:loaded_plugins, a:plugin)
    execute expr
  endwhile
endfunction

function! denops#plugin#wait_async(plugin, callback) abort
  if has_key(s:loaded_plugins, a:plugin)
    " Some features behave differently in functions invoked from timer_start()
    " so use it even for immediate execution to keep consistent behavior.
    call timer_start(0, { -> a:callback() })
    return
  endif
  let callbacks = get(s:load_callbacks, a:plugin, [])
  call add(callbacks, a:callback)
  let s:load_callbacks = callbacks
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
  for [plugin, script] in items(plugins)
    call s:register(plugin, script, meta, options)
  endfor
endfunction

function! s:gather_plugins(plugins) abort
  for runtimepath in split(&runtimepath, ',')
    let expr = denops#util#join_path(expand(runtimepath), 'denops', '*', 'main.ts')
    for script in glob(expr, 1, 1, 1)
      let plugin = fnamemodify(script, ':h:t')
      if plugin[:0] ==# '@' || has_key(a:plugins, plugin)
        continue
      endif
      call extend(a:plugins, { plugin : script })
    endfor
  endfor
endfunction

function! s:options(base, default) abort
  let options = extend(a:default, a:base)
  if has_key(options, 'reload')
    call denops#util#warn('The "reload" option is deprecated. Use "mode" option instead.')
    let options.mode = 'reload'
  endif
  if options.mode !~# '^\(reload\|skip\|error\)$'
    throw printf('Unknown mode "%s" is specified', options.mode)
  endif
  return options
endfunction

function! s:register(plugin, script, meta, options) abort
  let args = [a:plugin, a:script, a:meta, a:options]
  call denops#util#debug(printf('register plugin: %s', args))
  return denops#server#notify('invoke', ['register', args])
endfunction

function! s:find_plugin(plugin) abort
  for runtimepath in split(&runtimepath, ',')
    let script = denops#util#join_path(expand(runtimepath), 'denops', a:plugin, 'main.ts')
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
  let s:loaded_plugins[plugin] = 1
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

augroup denops_autoload_plugin_internal
  autocmd!
  autocmd User DenopsPluginPost:* call s:DenopsPluginPost()
  autocmd User DenopsStopped let s:loaded_plugins = {}
augroup END

let g:denops#plugin#wait_interval = get(g:, 'denops#plugin#wait_interval', 10)
