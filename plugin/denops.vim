if exists('g:loaded_denops')
  finish
endif
let g:loaded_denops = 1

function! s:error_handler(err) abort
  if type(a:err) is# v:t_dict
    call denops#error(get(a:err, 'exception', a:err))
    call denops#debug(get(a:err, 'throwpoint', ''))
  else
    call denops#error(a:err)
  endif
endfunction

" Register on_unhandled_rejection
call denops#promise#on_unhandled_rejection(funcref('s:error_handler'))

augroup denops_plugin_internal
  autocmd!
  autocmd VimEnter * call denops#server#start()
augroup END
