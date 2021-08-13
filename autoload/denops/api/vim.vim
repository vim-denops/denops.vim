let s:redraw_timer = -1
let s:redraw_interval = 10

function! s:debounce_redraw() abort
  call timer_stop(s:redraw_timer)
  let s:redraw_timer = timer_start(s:redraw_interval, { -> execute('redraw') })
endfunction

" NOTE:
" This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
" above SILENCE any errors occured in `call` channel command.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#call(fn, args) abort
  try
    return [call(a:fn, a:args), '']
  catch
    return [v:null, v:exception]
  finally
    call s:debounce_redraw()
  endtry
endfunction

" NOTE:
" This is a workaround function to detect errors in Vim before 8.2.3081 IGNORE
" any errors occured in `call` channel command thus we need to use `ex` command
" with `v:errmsg` instead.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#call_before_823081_pre(fn, args) abort
  let s:call_before_823081 = {
        \ 'fn': a:fn,
        \ 'args': a:args,
        \}
endfunction
function! denops#api#vim#call_before_823081_call() abort
  let v:errmsg = ''
  let g:denops#api#vim#call_before_823081 = v:null
  let g:denops#api#vim#call_before_823081 = call(s:call_before_823081.fn, s:call_before_823081.args)
  call s:debounce_redraw()
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
  finally
    call s:debounce_redraw()
  endtry
endfunction

" NOTE:
" This is a workaround function to detect errors in Vim before 8.2.3081 IGNORE
" any errors occured in `call` channel command thus we need to use `ex` command
" with `v:errmsg` instead.
" https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
function! denops#api#vim#batch_before_823081_pre(calls) abort
  let s:batch_before_823081 = a:calls
endfunction
function! denops#api#vim#batch_before_823081_call() abort
  let v:errmsg = ''
  let g:denops#api#vim#batch_before_823081 = []
  for l:Call in s:batch_before_823081
    let result = call(Call[0], Call[1:])
    if v:errmsg !=# ''
      break
    endif
    call add(g:denops#api#vim#batch_before_823081, result)
  endfor
  call s:debounce_redraw()
endfunction
