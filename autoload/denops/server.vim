function! denops#server#start() abort
  call denops#server#channel#stop()
  call denops#server#service#stop()
  call denops#server#channel#start({ address -> s:start_service(address) })
endfunction

function! s:start_service(address) abort
  call denops#server#service#start(a:address)
  doautocmd <nomodeline> User DenopsReady
endfunction

augroup denops_server_internal
  autocmd!
  autocmd User DenopsReady :
augroup END
