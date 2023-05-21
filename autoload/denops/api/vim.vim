" NOTE:
" This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
" above SILENCE any errors occurred in `call` channel command.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#call(fn, args) abort
  try
    let l:result = call(a:fn, a:args)
    if g:denops#debug
      " Check if the result is serializable
      call json_encode(l:result)
    endif
    return [l:result, '']
  catch
    return [v:null, v:exception . "\n" . v:throwpoint]
  endtry
endfunction

" NOTE:
" This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
" above SILENCE any errors occurred in `call` channel command.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#batch(calls) abort
  let l:results = []
  try
    call map(a:calls, {_, v -> add(l:results, call(v[0], v[1:]))})
    if g:denops#debug
      " Check if the result is serializable
      call json_encode(l:results)
    endif
    return [l:results, '']
  catch
    return [l:results, v:exception . "\n" . v:throwpoint]
  endtry
endfunction
