function! denops#_internal#plugin#collect() abort
  let l:pattern = denops#_internal#path#join(['denops', '*', 'main.ts'])
  let l:plugins = []
  for l:script in globpath(&runtimepath, l:pattern, 1, 1, 1)
    let l:name = fnamemodify(l:script, ':h:t')
    if l:name[:0] ==# '@' || !filereadable(l:script)
      continue
    endif
    call add(l:plugins, #{ name: l:name, script: l:script })
  endfor
  return l:plugins
endfunction

function! denops#_internal#plugin#find(name) abort
  let l:pattern = denops#_internal#path#join(['denops', a:name, 'main.ts'])
  for l:script in globpath(&runtimepath, l:pattern, 1, 1, 1)
    let l:name = fnamemodify(l:script, ':h:t')
    if l:name[:0] ==# '@' || !filereadable(l:script)
      continue
    endif
    return #{ name: l:name, script: l:script }
  endfor
  throw printf('No denops plugin for "%s" exists', a:name)
endfunction
