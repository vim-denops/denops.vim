function! denops#plugin#register(name, script, ...) abort
  let meta = denops#util#meta()
  let options = s:options(a:0 > 0 ? a:1 : {})
  return s:register(a:name, a:script, meta, options)
endfunction

function! denops#plugin#discover(...) abort
  let meta = denops#util#meta()
  let options = s:options(a:0 > 0 ? a:1 : {})
  let plugins = {}
  call s:gather_plugins(plugins)
  for [name, script] in items(plugins)
    call s:register(name, script, meta, options)
  endfor
endfunction

function! s:gather_plugins(plugins) abort
  for runtimepath in split(&runtimepath, ',')
    let path = expand(runtimepath)
    let expr = denops#util#join_path(path, 'denops', '*', 'main.ts')
    for script in glob(expr, 1, 1, 1)
      let name = fnamemodify(script, ':h:t')
      if name[:0] ==# '@' || has_key(a:plugins, name)
        continue
      endif
      call extend(a:plugins, { name : script })
    endfor
  endfor
endfunction

function! s:options(base) abort
  let default = {
        \ 'reload': v:false,
        \}
  return extend(default, a:base)
endfunction

function! s:register(name, script, meta, options) abort
  let args = [a:name, a:script, a:meta, a:options]
  call denops#util#debug(printf('register plugin: %s', args))
  return denops#server#channel#notify('invoke', ['register', args])
endfunction
