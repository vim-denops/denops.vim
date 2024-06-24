const s:DELAYED_INTERVAL = 100

let s:delayed_messages = []
let s:delayed_timer = 0

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
  call s:echomsg_delay('Title', a:000)
endfunction

function! denops#_internal#echo#warn(...) abort
  call s:echomsg_delay('WarningMsg', a:000)
endfunction

function! denops#_internal#echo#error(...) abort
  call s:echomsg_delay('ErrorMsg', a:000)
endfunction

function! s:echomsg(hl, msg) abort
  execute printf('echohl %s', a:hl)
  for l:line in split(join(a:msg), '\n')
    echomsg printf('[denops] %s', l:line)
  endfor
  echohl None
endfunction

function! s:echomsg_delay(hl, msg) abort
  call add(s:delayed_messages, [a:hl, a:msg])
  call timer_stop(s:delayed_timer)
  let s:delayed_timer = timer_start(s:DELAYED_INTERVAL, {-> s:echomsg_batch()})
endfunction

function! s:echomsg_batch() abort
  let l:counter = 0
  for l:message in s:delayed_messages
    call s:echomsg(l:message[0], l:message[1])
    let l:counter += len(split(join(l:message[1]), '\n'))
  endfor
  let s:delayed_timer = 0
  let s:delayed_messages = []
  " Forcibly show the messages to the user
  call feedkeys(printf(":\<C-u>%dmessages\<CR>", l:counter), 'nt')
endfunction
