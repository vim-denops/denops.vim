const s:STATE_RESERVED = 'reserved'
const s:STATE_LOADING = 'loading'
const s:STATE_LOADED = 'loaded'
const s:STATE_UNLOADING = 'unloading'
const s:STATE_FAILED = 'failed'

let s:plugins = {}

function! denops#_internal#plugin#get(name) abort
  if !has_key(s:plugins, a:name)
    let s:plugins[a:name] = #{name: a:name, script: '', state: s:STATE_RESERVED, callbacks: []}
  endif
  return s:plugins[a:name]
endfunction

function! denops#_internal#plugin#list() abort
  return values(s:plugins)
endfunction

function! denops#_internal#plugin#load(name, script) abort
  const l:script = denops#_internal#path#norm(a:script)
  const l:args = [a:name, l:script]
  let l:plugin = denops#_internal#plugin#get(a:name)
  if l:plugin.state !=# s:STATE_RESERVED && l:plugin.state !=# s:STATE_FAILED
    call denops#_internal#echo#debug(printf('already loaded. skip: %s', l:args))
    return
  endif
  let l:plugin.state = s:STATE_LOADING
  let l:plugin.script = l:script
  call denops#_internal#echo#debug(printf('load plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['load', l:args])
endfunction

function! denops#_internal#plugin#unload(name) abort
  const l:args = [a:name]
  let l:plugin = denops#_internal#plugin#get(a:name)
  if l:plugin.state ==# s:STATE_LOADED
    let l:plugin.state = s:STATE_UNLOADING
  endif
  call denops#_internal#echo#debug(printf('unload plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['unload', l:args])
endfunction

function! denops#_internal#plugin#reload(name) abort
  const l:args = [a:name]
  let l:plugin = denops#_internal#plugin#get(a:name)
  if l:plugin.state ==# s:STATE_LOADED
    let l:plugin.state = s:STATE_UNLOADING
  endif
  call denops#_internal#echo#debug(printf('reload plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['reload', l:args])
endfunction

function! s:DenopsSystemPluginPre() abort
  const l:name = matchstr(expand('<amatch>'), 'DenopsSystemPluginPre:\zs.*')
  let l:plugin = denops#_internal#plugin#get(l:name)
  let l:plugin.state = s:STATE_LOADING
  call denops#_internal#event#emit(printf('DenopsPluginPre:%s', l:name))
endfunction

function! s:DenopsSystemPluginPost() abort
  const l:name = matchstr(expand('<amatch>'), 'DenopsSystemPluginPost:\zs.*')
  let l:plugin = denops#_internal#plugin#get(l:name)
  const l:callbacks = l:plugin.callbacks
  let l:plugin.state = s:STATE_LOADED
  let l:plugin.callbacks = []
  for l:Callback in l:callbacks
    call l:Callback()
  endfor
  call denops#_internal#event#emit(printf('DenopsPluginPost:%s', l:name))
endfunction

function! s:DenopsSystemPluginFail() abort
  const l:name = matchstr(expand('<amatch>'), 'DenopsSystemPluginFail:\zs.*')
  let l:plugin = denops#_internal#plugin#get(l:name)
  let l:plugin.state = s:STATE_FAILED
  let l:plugin.callbacks = []
  call denops#_internal#event#emit(printf('DenopsPluginFail:%s', l:name))
endfunction

function! s:DenopsSystemPluginUnloadPre() abort
  const l:name = matchstr(expand('<amatch>'), 'DenopsSystemPluginUnloadPre:\zs.*')
  let l:plugin = denops#_internal#plugin#get(l:name)
  let l:plugin.state = s:STATE_UNLOADING
  call denops#_internal#event#emit(printf('DenopsPluginUnloadPre:%s', l:name))
endfunction

function! s:DenopsSystemPluginUnloadPost() abort
  const l:name = matchstr(expand('<amatch>'), 'DenopsSystemPluginUnloadPost:\zs.*')
  let l:plugin = denops#_internal#plugin#get(l:name)
  let l:plugin.state = s:STATE_RESERVED
  call denops#_internal#event#emit(printf('DenopsPluginUnloadPost:%s', l:name))
endfunction

function! s:DenopsSystemPluginUnloadFail() abort
  const l:name = matchstr(expand('<amatch>'), 'DenopsSystemPluginUnloadFail:\zs.*')
  let l:plugin = denops#_internal#plugin#get(l:name)
  let l:plugin.state = s:STATE_RESERVED
  let l:plugin.callbacks = []
  call denops#_internal#event#emit(printf('DenopsPluginUnloadFail:%s', l:name))
endfunction

augroup denops_autoload_plugin_internal
  autocmd!
  autocmd User DenopsSystemPluginPre:* ++nested call s:DenopsSystemPluginPre()
  autocmd User DenopsSystemPluginPost:* ++nested call s:DenopsSystemPluginPost()
  autocmd User DenopsSystemPluginFail:* ++nested call s:DenopsSystemPluginFail()
  autocmd User DenopsSystemPluginUnloadPre:* ++nested call s:DenopsSystemPluginUnloadPre()
  autocmd User DenopsSystemPluginUnloadPost:* ++nested call s:DenopsSystemPluginUnloadPost()
  autocmd User DenopsSystemPluginUnloadFail:* ++nested call s:DenopsSystemPluginUnloadFail()
  autocmd User DenopsClosed let s:plugins = {}
augroup END
