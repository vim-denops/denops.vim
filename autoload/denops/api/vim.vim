" NOTE:
" This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
" above SILENCE any errors occured in `call` channel command.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#call(fn, args) abort
  try
    return [call(a:fn, a:args), '']
  catch
    return [v:null, v:exception]
  endtry
endfunction

" NOTE:
" This is a workaround function to detect errors in Vim while Vim 8.2.3080 or
" below IGNORE any errors occured in `call` channel command thus we need to
" use `ex` command with `v:errmsg` instead.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#call_before_823080_pre(fn, args) abort
  let s:call_before_823080 = {
        \ 'fn': a:fn,
        \ 'args': a:args,
        \}
endfunction
function! denops#api#vim#call_before_823080_call() abort
  let v:errmsg = ''
  let g:denops#api#vim#call_before_823080 = v:null
  let g:denops#api#vim#call_before_823080 = call(s:call_before_823080.fn, s:call_before_823080.args)
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
    return [results, v:exception]
  endtry
endfunction

" NOTE:
" This is a workaround function to detect errors in Vim while Vim 8.2.3080 or
" below IGNORE any errors occured in `call` channel command thus we need to
" use `ex` command with `v:errmsg` instead.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#batch_before_823080_pre(calls) abort
  let s:batch_before_823080 = a:calls
endfunction
function! denops#api#vim#batch_before_823080_call() abort
  let v:errmsg = ''
  let g:denops#api#vim#batch_before_823080 = []
  for l:Call in s:batch_before_823080
    let result = call(Call[0], Call[1:])
    if v:errmsg !=# ''
      break
    endif
    call add(g:denops#api#vim#batch_before_823080, result)
  endfor
endfunction
