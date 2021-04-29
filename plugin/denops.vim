if exists('g:loaded_denops')
  finish
endif
let g:loaded_denops = 1

augroup denops_plugin_internal
  autocmd!
  autocmd VimEnter * call denops#server#start()
  autocmd User DenopsReady call denops#plugin#discover()
augroup END
