function! denops#server#start() abort
  return denops#server#channel#start()
        \.then({ address -> denops#server#service#start(address) })
        \.then({ -> s:on_service_ready() })
endfunction

function! denops#server#restart() abort
  return denops#server#channel#restart()
        \.then({ address -> denops#server#service#restart(address) })
        \.then({ -> s:on_service_ready() })
endfunction

function! s:on_service_ready() abort
  doautocmd <nomodeline> User DenopsReady
endfunction

augroup denops_server_internal
  autocmd!
  autocmd User DenopsReady :
augroup END
