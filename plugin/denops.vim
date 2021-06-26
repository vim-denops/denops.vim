if exists('g:loaded_denops')
  finish
endif
let g:loaded_denops = 1

if !executable(g:denops#deno)
  echohl WarningMsg
  echo printf("[denops] A '%s' (g:denops#deno) is not executable. Denops requires executable Deno.", g:denops#deno)
  echohl None
  finish
endif

augroup denops_plugin_internal
  autocmd!
  autocmd VimEnter * call denops#server#start()
  autocmd User DenopsReady call denops#plugin#discover()
augroup END
