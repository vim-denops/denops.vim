let s:file = expand('<sfile>:p')
let s:repository_root = fnamemodify(s:file, ':h:h:h')

function! denops#shared_server#install() abort
  if !exists('g:denops_server_addr')
    call denops#util#error('No `g:denops_server_addr` is defined. Please read `:help denops-shared-server`.')
    return
  endif
  let [hostname, port] = s:parse_server_addr(g:denops_server_addr)
  let options = {
        \ 'deno': exepath(g:denops#deno),
        \ 'denops': s:repository_root,
        \ 'hostname': hostname,
        \ 'port': port,
        \}
  if executable('launchctl')
    call denops#shared_server#launchctl#install(options)
  else
    call denops#util#error('This platform is not supported. Please configure denops-shared-server manually.')
    return
  endif
endfunction

function! denops#shared_server#uninstall() abort
  if executable('launchctl')
    call denops#shared_server#launchctl#uninstall()
  else
    call denops#util#error('This platform is not supported. Please configure denops-shared-server manually.')
    return
  endif
endfunction

function! s:parse_server_addr(addr) abort
  let parts = split(a:addr, ':', v:true)
  if len(parts) isnot# 2
    throw printf('[denops] Server address must follow `{hostname}:{port}` format but `%s` is given', a:addr)
  endif
  return [parts[0], parts[1]]
endfunction
