function! denops#_internal#echo#deprecate(...) abort
  if g:denops#disable_deprecation_warning_message
    return
  endif
  call s:echomsg('WarningMsg', a:000)
endfunction

function! s:echomsg(hl, msg) abort
  execute printf('echohl %s', a:hl)
  for l:line in split(a:msg, '\n')
    echomsg printf('[denops] %s', l:line)
  endfor
  echohl None
endfunction
