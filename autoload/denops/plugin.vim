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

function! denops#plugin#unload(name) abort
  call denops#_internal#plugin#unload(a:name)
endfunction

function! denops#plugin#reload(name) abort
  call denops#_internal#plugin#reload(a:name)
endfunction

function! denops#plugin#discover() abort
  const l:pattern = denops#_internal#path#join(['denops', '*', 'main.ts'])
  let l:counter = 0 
  for l:script in globpath(&runtimepath, l:pattern, 1, 1, 1)
    let l:name = fnamemodify(l:script, ':h:t')
    if !denops#_internal#plugin#is_valid_name(l:name) || !filereadable(l:script)
      continue
    endif
    call denops#plugin#load(l:name, l:script)
    let l:counter += 1
  endfor
  call denops#_internal#echo#debug(printf('%d plugins are discovered', l:counter))
endfunction

function! denops#plugin#check_type(...) abort
  if a:0
    const l:plugins = [denops#_internal#plugin#get(a:1)]
  else
    const l:plugins = denops#_internal#plugin#list()
  endif
  const l:scripts = l:plugins
        \->mapnew({ _, v -> v.script })->filter({ _, v -> v !=# '' })
  if empty(l:scripts)
    call denops#_internal#echo#info("No plugins are loaded")
    return
  endif
  let l:args = [g:denops#deno, 'check'] + l:scripts
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

call denops#_internal#conf#define('denops#plugin#wait_interval', 200)
call denops#_internal#conf#define('denops#plugin#wait_timeout', 30000)
