function! denops#plugin#register(plugin, script) abort
  call denops#util#debug(printf('register `%s` plugin as `%s`', a:plugin, a:script))
  return denops#server#channel#notify('invoke', ['register', [a:plugin, a:script]])
endfunction

function! denops#plugin#discover() abort
  let plugins = {}
  call s:gather_plugins(plugins)
  for [name, script] in items(plugins)
    call denops#plugin#register(name, script)
  endfor
endfunction

function! s:gather_plugins(plugins) abort
  for runtimepath in split(&runtimepath, ',')
    let path = expand(runtimepath)
    let expr = denops#util#join_path(path, 'denops', '*', 'app.ts')
    for script in glob(expr, 1, 1, 1)
      let name = fnamemodify(script, ':h:t')
      if name[:0] ==# '@' || has_key(a:plugins, name)
        continue
      endif
      call extend(a:plugins, { name : script })
    endfor
  endfor
endfunction
