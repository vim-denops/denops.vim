let s:loaded_plugins = {}
let s:load_callbacks = {}

function! denops#plugin#is_loaded(name) abort
  return has_key(s:loaded_plugins, a:name)
endfunction

function! denops#plugin#wait(name, ...) abort
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
            \ a:name,
            \))
    endif
    return -2
  endif
  if has_key(s:loaded_plugins, a:name)
    return s:loaded_plugins[a:name]
  endif
  let l:ret = denops#_internal#wait#for(
        \ l:options.timeout,
        \ { -> has_key(s:loaded_plugins, a:name) },
        \ l:options.interval,
        \)
  if l:ret is# -1
    if !l:options.silent
      call denops#_internal#echo#error(printf(
            \ 'Failed to wait for "%s" to start. It took more than %d milliseconds and timed out.',
            \ a:name,
            \ l:options.timeout,
            \))
    endif
    return -1
  endif
endfunction

function! denops#plugin#wait_async(name, callback) abort
  if has_key(s:loaded_plugins, a:name)
    if s:loaded_plugins[a:name] isnot# 0
      return
    endif
    call a:callback()
    return
  endif
  let l:callbacks = get(s:load_callbacks, a:name, [])
  call add(l:callbacks, a:callback)
  let s:load_callbacks[a:name] = l:callbacks
endfunction

" DEPRECATED
" Some plugins (e.g. dein.vim) use this function with options thus we cannot
" change the interface of this function.
" That's why we introduce 'load' function that replaces this function.
function! denops#plugin#register(name, ...) abort
  call denops#_internal#echo#deprecate(
        \ 'denops#plugin#register() is deprecated. Use denops#plugin#load() instead.',
        \)
  if a:0 is# 0 || type(a:1) is# v:t_dict
    let l:script = denops#_internal#plugin#find(a:name).script
  else
    let l:script = a:1
  endif
  return denops#plugin#load(a:name, l:script)
endfunction

function! denops#plugin#load(name, script, ...) abort
  let l:script = denops#_internal#path#norm(a:script)
  let l:args = [a:name, l:script] + a:000
  call denops#_internal#echo#debug(printf('load plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['load', l:args])
endfunction

function! denops#plugin#unload(name) abort
  let l:args = [a:name]
  call denops#_internal#echo#debug(printf('unload plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['unload', l:args])
endfunction

function! denops#plugin#reload(name, ...) abort
  let l:args = [a:name] + a:000
  call denops#_internal#echo#debug(printf('reload plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['reload', l:args])
endfunction

function! denops#plugin#discover() abort
  let l:plugins = denops#_internal#plugin#collect()
  call denops#_internal#echo#debug(printf('%d plugins are discovered', len(l:plugins)))
  for l:plugin in l:plugins
    call denops#plugin#load(l:plugin.name, l:plugin.script)
  endfor
endfunction

function! denops#plugin#check_type(...) abort
  let l:plugins = a:0
        \ ? [denops#_internal#plugin#find(a:1)]
        \ : denops#_internal#plugin#collect()
  let l:args = [g:denops#deno, 'check']
  let l:args = extend(l:args, map(l:plugins, { _, v -> v.script }))
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

function! s:teardown_settled(name) abort
  let l:plugin = matchstr(expand('<amatch>'), ':\zs.*')
  if has_key(s:loaded_plugins, l:plugin)
    call remove(s:loaded_plugins, l:plugin)
  endif
  execute printf('doautocmd <nomodeline> User %s:%s', a:name, l:plugin)
endfunction

augroup denops_autoload_plugin_internal
  autocmd!
  autocmd User DenopsSystemPluginPre:* call s:relay_autocmd('DenopsPluginPre')
  autocmd User DenopsSystemPluginPost:* ++nested call s:DenopsSystemPluginPost()
  autocmd User DenopsSystemPluginFail:* call s:DenopsSystemPluginFail()
  autocmd User DenopsSystemPluginUnloadPre:* call s:relay_autocmd('DenopsPluginUnloadPre')
  autocmd User DenopsSystemPluginUnloadPost:* ++nested call s:teardown_settled('DenopsPluginUnloadPost')
  autocmd User DenopsSystemPluginUnloadFail:* ++nested call s:teardown_settled('DenopsPluginUnloadFail')
  autocmd User DenopsClosed let s:loaded_plugins = {}
augroup END

call denops#_internal#conf#define('denops#plugin#wait_interval', 200)
call denops#_internal#conf#define('denops#plugin#wait_timeout', 30000)
