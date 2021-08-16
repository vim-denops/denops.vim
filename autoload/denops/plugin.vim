function! denops#plugin#register(name, ...) abort
  if a:0 is# 0 || type(a:1) is# v:t_dict
    let options = s:options(a:0 > 0 ? a:1 : {})
    let script = s:find_plugin(a:name)
  else
    let script = a:1
    let options = s:options(a:0 > 1 ? a:2 : {})
  endif
  let meta = denops#util#meta()
  return s:register(a:name, script, meta, options)
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
    let expr = denops#util#join_path(expand(runtimepath), 'denops', '*', 'main.ts')
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
  let options = extend({
        \ 'mode': 'error',
        \}, a:base,
        \)
  if has_key(options, 'reload')
    call denops#util#warn('The "reload" option is deprecated. Use "mode" option instead.')
    let options.mode = 'reload'
  endif
  if options.mode !~# '^\(reload\|error\)$'
    throw printf('Unknown mode "%s" is specified', options.mode)
  endif
  return options
endfunction

function! s:register(name, script, meta, options) abort
  let args = [a:name, a:script, a:meta, a:options]
  call denops#util#debug(printf('register plugin: %s', args))
  return denops#server#channel#notify('invoke', ['register', args])
endfunction

function! s:find_plugin(name) abort
  for runtimepath in split(&runtimepath, ',')
    let script = denops#util#join_path(expand(runtimepath), 'denops', a:name, 'main.ts')
    let name = fnamemodify(script, ':h:t')
    if name[:0] ==# '@' || !filereadable(script)
      continue
    endif
    return script
  endfor
  throw printf('No denops plugin for "%s" exists', a:name)
endfunction
