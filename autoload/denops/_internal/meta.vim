function! denops#_internal#meta#get() abort
  let l:mode = g:denops#_test ? 'test' : g:denops#debug ? 'debug' : 'release'
  let s:meta = exists('s:meta') ? s:meta : s:get()
  return extend({'mode': l:mode}, s:meta, 'keep')
endfunction

function! s:get() abort
  let l:host = has('nvim') ? 'nvim' : 'vim'
  let l:version = s:get_host_version()
  let l:platform = has('win32') ? 'windows' : has('mac') ? 'mac' : 'linux'
  return {
        \ 'host': l:host,
        \ 'version': l:version,
        \ 'platform': l:platform,
        \}
endfunction

if has('nvim')
  function! s:get_host_version() abort
    let l:output = execute('version')
    return matchstr(l:output, 'NVIM v\zs[0-9.]\+')
  endfunction
else
  function! s:get_host_version() abort
    let l:output = execute('version')
    let l:major = matchstr(l:output, 'Vi IMproved \zs[0-9.]\+')
    let l:patch = matchstr(l:output, 'Included patches: [0-9]\+-\zs[0-9]\+')
    return printf('%s.%s', l:major, l:patch)
  endfunction
endif
