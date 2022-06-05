if exists('g:loaded_denops')
  finish
endif
let g:loaded_denops = 1

if !get(g:, 'denops_disable_version_check') && !has('nvim-0.6.0') && !has('patch-8.2.3452')
  echohl WarningMsg
  echomsg '[denops] Denops requires Vim 8.2.3452 or Neovim 0.6.0. See ":h g:denops_disable_version_check" to disable this check.'
  echohl None
  finish
endif

if !executable(g:denops#deno)
  echohl WarningMsg
  echomsg printf("[denops] A '%s' (g:denops#deno) is not executable. Denops requires executable Deno.", g:denops#deno)
  echohl None
  finish
endif

augroup denops_plugin_internal
  autocmd!
  autocmd User DenopsReady call denops#plugin#discover()
  autocmd User DenopsPluginPre:* :
  autocmd User DenopsPluginPost:* :
augroup END

function! s:init() abort
  let addr = get(g:, 'denops_server_addr')
  if !empty(addr)
    if denops#server#connect(addr)
      return
    endif
    " Fallback to a local denops server
  endif
  call denops#server#start()
endfunction

if has('vim_starting')
  augroup denops_plugin_internal_startup
    autocmd!
    autocmd VimEnter * call s:init()
  augroup END
else
  call s:init()
endif
