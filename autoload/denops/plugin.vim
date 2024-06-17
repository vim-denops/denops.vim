function! denops#plugin#is_loaded(name) abort
  return denops#_internal#plugin#get(a:name).state =~# '^\%(loaded\|failed\)$'
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
  if !denops#plugin#is_loaded(a:name)
    let l:ret = denops#_internal#wait#for(
          \ l:options.timeout,
          \ { -> denops#plugin#is_loaded(a:name) },
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
  endif
  return denops#_internal#plugin#get(a:name).state ==# 'loaded' ? 0 : -3
endfunction

function! denops#plugin#wait_async(name, callback) abort
  let l:plugin = denops#_internal#plugin#get(a:name)
  if l:plugin.state ==# 'loaded'
    call a:callback()
    return
  elseif l:plugin.state ==# 'failed'
    return
  endif
  call add(l:plugin.callbacks, a:callback)
endfunction

function! denops#plugin#load(name, script) abort
  call denops#_internal#plugin#load(a:name, a:script)
endfunction

function! denops#plugin#reload(name) abort
  call denops#_internal#plugin#reload(a:name)
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

call denops#_internal#conf#define('denops#plugin#wait_interval', 200)
call denops#_internal#conf#define('denops#plugin#wait_timeout', 30000)
