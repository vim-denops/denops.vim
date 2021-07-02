function! denops#api#cmd(cmd, context) abort
  call extend(l:, a:context)
  call execute(a:cmd, '')
endfunction

function! denops#api#eval(expr, context) abort
  call extend(l:, a:context)
  return eval(a:expr)
endfunction

" NOTE: This function is useless for Vim 8.2.3080 or below
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#call(fn, args) abort
  try
    return [call(a:fn, a:args), '']
  catch
    return [v:null, v:exception]
  endtry
endfunction

function! denops#api#call_before_823080_pre(fn, args) abort
  let s:call_before_823080 = {
        \ 'fn': a:fn,
        \ 'args': a:args,
        \}
endfunction

function! denops#api#call_before_823080_call() abort
  let v:errmsg = ''
  let g:denops#api#call_before_823080 = v:null
  let g:denops#api#call_before_823080 = call(s:call_before_823080.fn, s:call_before_823080.args)
endfunction
