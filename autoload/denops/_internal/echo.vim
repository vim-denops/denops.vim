function! denops#_internal#echo#deprecate(...) abort
  if g:denops#disable_deprecation_warning_message
    return
  endif
  call s:echomsg('WarningMsg', a:000)
endfunction

function! denops#_internal#echo#log(...) abort
  call s:echomsg('None', a:000)
endfunction

function! denops#_internal#echo#debug(...) abort
  if !g:denops#debug
    return
  endif
  call s:echomsg('Comment', a:000)
endfunction

function! denops#_internal#echo#info(...) abort
  call s:echomsg('Title', a:000)
endfunction

function! denops#_internal#echo#warn(...) abort
  call s:echomsg('WarningMsg', a:000)
endfunction

function! denops#_internal#echo#error(...) abort
  call s:echomsg('ErrorMsg', a:000)
endfunction

function! s:echomsg(hl, msg) abort
  execute printf('echohl %s', a:hl)
  for l:line in split(join(a:msg), '\n')
    echomsg printf('[denops] %s', l:line)
  endfor
  echohl None
endfunction
