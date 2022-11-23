function! denops#_internal#wait#for(timeout, condition, interval) abort
  let l:timeout = g:denops#_internal#wait#timeout
  let l:timer = timer_start(l:timeout, { -> s:warn_wait(l:timeout) })
  try
    return s:wait(a:timeout, a:condition, a:interval)
  finally
    silent! call timer_stop(l:timer)
  endtry
endfunction

function! s:warn_wait(timeout) abort
  let l:m = printf(
        \ 'It tooks more than %d ms. Use Ctrl-C to cancel.',
        \ a:timeout,
        \)
  call denops#_internal#echo#warn(l:m)
endfunction

if exists('*wait')
  let s:wait = function('wait')
else
  function! s:wait(timeout, condition, interval) abort
    let l:waiter = printf('sleep %dm', a:interval)
    let l:s = reltime()
    try
      while !a:condition()
        if reltimefloat(reltime(l:s)) * 1000 > a:timeout
          return -1
        endif
        execute l:waiter
      endwhile
    catch /^Vim:Interrupt$/
      return -2
    endtry
  endfunction
endif

let g:denops#_internal#wait#timeout = get(g:, 'denops#_internal#wait#timeout', 5000)
