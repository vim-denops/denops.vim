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
    call a:callback()
    return
  endif
  let l:callbacks = get(s:load_callbacks, a:plugin, [])
  call add(l:callbacks, a:callback)
  let s:load_callbacks[a:plugin] = l:callbacks
endfunction

" DEPRECATED
" Some plugins (e.g. dein.vim) use this function with options thus we cannot
" change the interface of this function.
" That's why we introduce 'load' function that replaces this function.
function! denops#plugin#register(plugin, ...) abort
  call denops#_internal#echo#deprecate(
        \ 'denops#plugin#register() is deprecated. Use denops#plugin#load() instead.',
        \)
  if a:0 is# 0 || type(a:1) is# v:t_dict
    let l:script = s:find_plugin(a:plugin)
  else
    let l:script = a:1
  endif
  return denops#plugin#load(a:plugin, l:script)
endfunction

function! denops#plugin#load(plugin, script) abort
  let l:script = denops#_internal#path#norm(a:script)
  let l:args = [a:plugin, l:script]
  call denops#_internal#echo#debug(printf('load plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['load', l:args])
endfunction

function! denops#plugin#reload(plugin) abort
  let l:args = [a:plugin]
  call denops#_internal#echo#debug(printf('reload plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['reload', l:args])
endfunction

function! denops#plugin#discover() abort
  let l:plugins = {}
  call s:gather_plugins(l:plugins)
  call denops#_internal#echo#debug(printf('%d plugins are discovered', len(l:plugins)))
  for [l:plugin, l:script] in items(l:plugins)
    call denops#plugin#load(l:plugin, l:script)
  endfor
endfunction

function! denops#plugin#check_type(...) abort
  if !a:0
    let l:plugins = {}
    call s:gather_plugins(l:plugins)
  endif
  let l:args = [g:denops#deno, 'check']
  let l:args += a:0 ? [s:find_plugin(a:1)] : values(l:plugins)
  let l:job = denops#_internal#job#start(l:args, {
        \ 'env': {
        \   'NO_COLOR': 1,
        \   'DENO_NO_PROMPT': 1,
        \ },
        \ 'on_stderr': { _job, data, _event -> denops#_internal#echo#info(data) },
        \ 'on_exit': { _job, status, _event -> status
        \   ? denops#_internal#echo#error('Type check failed:', status)
        \   : denops#_internal#echo#info('Type check succeeded')
        \ },
        \ })
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

function! s:relay_autocmd(name) abort
  let l:plugin = matchstr(expand('<amatch>'), '^[^:]\+:\zs.*')
  execute printf('doautocmd <nomodeline> User %s:%s', a:name, l:plugin)
endfunction

function! s:DenopsSystemPluginPost() abort
  let l:plugin = matchstr(expand('<amatch>'), 'DenopsSystemPluginPost:\zs.*')
  let s:loaded_plugins[l:plugin] = 0
  if has_key(s:load_callbacks, l:plugin)
    for l:Callback in remove(s:load_callbacks, l:plugin)
      call l:Callback()
    endfor
  endif
  execute printf('doautocmd <nomodeline> User DenopsPluginPost:%s', l:plugin)
endfunction

function! s:DenopsSystemPluginFail() abort
  let l:plugin = matchstr(expand('<amatch>'), 'DenopsSystemPluginFail:\zs.*')
  let s:loaded_plugins[l:plugin] = -3
  if has_key(s:load_callbacks, l:plugin)
    call remove(s:load_callbacks, l:plugin)
  endif
  execute printf('doautocmd <nomodeline> User DenopsPluginFail:%s', l:plugin)
endfunction

augroup denops_autoload_plugin_internal
  autocmd!
  autocmd User DenopsSystemPluginWorkerPre:* call s:relay_autocmd('DenopsPluginWorkerPre')
  autocmd User DenopsSystemPluginWorkerPost:* call s:relay_autocmd('DenopsPluginWorkerPost')
  autocmd User DenopsSystemPluginPre:* call s:relay_autocmd('DenopsPluginPre')
  autocmd User DenopsSystemPluginPost:* ++nested call s:DenopsSystemPluginPost()
  autocmd User DenopsSystemPluginFail:* call s:DenopsSystemPluginFail()
  autocmd User DenopsClosed let s:loaded_plugins = {}
augroup END

call denops#_internal#conf#define('denops#plugin#wait_interval', 200)
call denops#_internal#conf#define('denops#plugin#wait_timeout', 30000)
