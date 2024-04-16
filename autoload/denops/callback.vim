let s:registry = {}

function! denops#callback#register(callback, ...) abort
  let l:options = extend({
        \ 'once': v:false,
        \}, a:0 ? a:1 : {},
        \)
  let l:id = sha256(string(a:callback))
  let s:registry[l:id] = {
        \ 'callback': a:callback,
        \ 'options': l:options,
        \}
  return l:id
endfunction

function! denops#callback#unregister(id) abort
  if !has_key(s:registry, a:id)
    return
  endif
  unlet s:registry[a:id]
endfunction

function! denops#callback#call(id, ...) abort
  if !has_key(s:registry, a:id)
    throw printf('No callback function for %s exist', a:id)
  endif
  let l:entry = s:registry[a:id]
  if l:entry.options.once
    unlet s:registry[a:id]
  endif
  return call(l:entry.callback, a:000)
endfunction

function! denops#callback#clear() abort
  let s:registry = {}
endfunction
