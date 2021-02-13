function! denops#api#echo(text) abort
  for line in split(a:msg, '\n')
    echo line
  endfor
endfunction

function! denops#api#echomsg(text) abort
  for line in split(a:msg, '\n')
    echomsg line
  endfor
endfunction
