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
  silent unlet s:registry[a:id]
endfunction

function! denops#callback#call(id, ...) abort
  if !has_key(s:registry, a:id)
    throw printf('No callback function for %s exist', a:id)
  endif
  let l:entry = s:registry[a:id]
  let l:ret = call(l:entry.callback, a:000)
  if l:entry.options.once
    call denops#callback#unregister(a:id)
  endif
  return l:ret
endfunction

function! denops#callback#clear() abort
  let s:registry = {}
endfunction
