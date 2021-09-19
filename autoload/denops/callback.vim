let s:registry = {}

function! denops#callback#add(callback, ...) abort
  call denops#util#warn('denops#callback#add is deprecated. Use denops#callback#register instead.')
  let options = extend({
        \ 'once': v:true,
        \}, a:0 ? a:1 : {},
        \)
  return denops#callback#register(a:callback, options)
endfunction

function! denops#callback#remove(id) abort
  call denops#util#warn('denops#callback#remove is deprecated. Use denops#callback#unregister instead.')
  call denops#callback#unregister(a:id)
endfunction

function! denops#callback#register(callback, ...) abort
  let options = extend({
        \ 'once': v:false,
        \}, a:0 ? a:1 : {},
        \)
  let id = sha256(string(get(a:callback, 'func')))
  let s:registry[id] = {
        \ 'callback': a:callback,
        \ 'options': options,
        \}
  return id
endfunction

function! denops#callback#unregister(id) abort
  if !has_key(s:registry, a:id)
    return
  endif
  silent unlet s:registry[a:id]
endfunction

function! denops#callback#call(id, ...) abort
  if !has_key(s:registry, a:id)
    throw printf('No callback function for %s exist', a:id)
  endif
  let entry = s:registry[a:id]
  let ret = call(entry.callback, a:000)
  if entry.options.once
    call denops#callback#remove(a:id)
  endif
  return ret
endfunction

function! denops#callback#clear() abort
  let s:registry = {}
endfunction
