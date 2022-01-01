" NOTE:
" This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
" above SILENCE any errors occured in `call` channel command.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#call(fn, args) abort
  try
    return [call(a:fn, a:args), '']
  catch
    return [v:null, v:exception . "\n" . v:throwpoint]
  endtry
endfunction

" NOTE:
" This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
" above SILENCE any errors occured in `call` channel command.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#batch(calls) abort
  let results = []
  try
    for l:Call in a:calls
      call add(results, call(Call[0], Call[1:]))
    endfor
    return [results, '']
  catch
    return [results, v:exception . "\n" . v:throwpoint]
  endtry
endfunction
