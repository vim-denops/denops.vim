if exists('g:loaded_denops_debug')
  finish
endif
let g:loaded_denops_debug = 1

augroup denops_debug_plugin_internal
  autocmd!
  autocmd User DenopsReady,DenopsStarted,DenopsStopped
        \  call denops#util#debug(expand('<amatch>:t'))
  autocmd User DenopsPluginPre:*,DenopsPluginPost:*
        \  call denops#util#debug(expand('<amatch>:t'))
augroup END
