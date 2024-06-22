const s:STATE_RESERVED = 'reserved'
const s:STATE_LOADING = 'loading'
const s:STATE_LOADED = 'loaded'
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
  let l:plugin.state = s:STATE_LOADING
  let l:plugin.script = l:script
  let s:plugins[a:name] = l:plugin
  call denops#_internal#echo#debug(printf('load plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['load', l:args])
endfunction

function! denops#_internal#plugin#reload(name) abort
  const l:args = [a:name]
  let l:plugin = denops#_internal#plugin#get(a:name)
  let l:plugin.state = s:STATE_LOADING
  call denops#_internal#echo#debug(printf('reload plugin: %s', l:args))
  call denops#_internal#server#chan#notify('invoke', ['reload', l:args])
endfunction

function! s:DenopsSystemPluginPre() abort
  const l:name = matchstr(expand('<amatch>'), 'DenopsSystemPluginPre:\zs.*')
  execute printf('doautocmd <nomodeline> User DenopsPluginPre:%s', l:name)
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
  execute printf('doautocmd <nomodeline> User DenopsPluginPost:%s', l:name)
endfunction

function! s:DenopsSystemPluginFail() abort
  const l:name = matchstr(expand('<amatch>'), 'DenopsSystemPluginFail:\zs.*')
  let l:plugin = denops#_internal#plugin#get(l:name)
  let l:plugin.state = s:STATE_FAILED
  let l:plugin.callbacks = []
  execute printf('doautocmd <nomodeline> User DenopsPluginFail:%s', l:name)
endfunction

augroup denops_autoload_plugin_internal
  autocmd!
  autocmd User DenopsSystemPluginPre:* ++nested call s:DenopsSystemPluginPre()
  autocmd User DenopsSystemPluginPost:* ++nested call s:DenopsSystemPluginPost()
  autocmd User DenopsSystemPluginFail:* ++nested call s:DenopsSystemPluginFail()
  autocmd User DenopsClosed let s:plugins = {}
augroup END
