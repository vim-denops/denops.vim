let s:STATUS_STOPPED = 'stopped'
let s:STATUS_RUNNING = 'running'
let s:status = s:STATUS_STOPPED

function! denops#server#start() abort
  if s:status is# s:STATUS_RUNNING
    call denops#debug('Servers are already running. Skip')
    return
  endif
  let s:status = s:STATUS_RUNNING
  call denops#server#channel#start({ address -> s:start_service(address) })
endfunction

function! denops#server#stop() abort
  call denops#server#channel#stop()
  call denops#server#service#stop()
  let s:status = s:STATUS_STOPPED
endfunction

function! denops#server#restart() abort
  call denops#server#stop()
  call denops#server#start()
endfunction

function! denops#server#status() abort
  return s:status
endfunction

function! s:start_service(address) abort
  call denops#server#service#start(a:address)
  doautocmd <nomodeline> User DenopsReady
endfunction

augroup denops_server_internal
  autocmd!
  autocmd User DenopsReady :
augroup END
