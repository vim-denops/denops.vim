function! denops#plugin#register(plugin, script) abort
  call denops#debug(printf('register `%s` plugin as `%s`', a:plugin, a:script))
  return denops#server#channel#notify('register', [a:plugin, a:script])
endfunction

function! denops#plugin#discover() abort
  for runtimepath in split(&runtimepath, ',')
    let path = expand(runtimepath)
    let expr = denops#util#join_path(path, 'denops', '*', 'mod.ts')
    for script in glob(expr, 1, 1, 1)
      let name = fnamemodify(script, ':h:t')
      call denops#plugin#register(name, script)
    endfor
  endfor
endfunction
