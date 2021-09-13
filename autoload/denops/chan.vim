function! denops#chan#connect(address) abort
  return s:connect(a:address)
endfunction

function! denops#chan#notify(chan, method, params) abort
  return s:notify(a:chan, a:method, a:params)
endfunction

function! denops#chan#request(chan, method, params) abort
  return s:request(a:chan, a:method, a:params)
endfunction


if has('nvim')
  function! s:connect(address) abort
    let chan = sockconnect('tcp', a:address, {
          \ 'rpc': v:true,
          \})
    if chan is# 0
      throw printf('Failed to connect `%s`', a:address)
    endif
    return chan
  endfunction

  function! s:notify(chan, method, params) abort
    return call('rpcnotify', [a:chan, a:method] + a:params)
  endfunction

  function! s:request(chan, method, params) abort
    return call('rpcrequest', [a:chan, a:method] + a:params)
  endfunction
else
  function! s:connect(address) abort
    let chan = ch_open(a:address, {
          \ 'mode': 'json',
          \ 'drop': 'auto',
          \ 'noblock': 1,
          \ 'timeout': 60 * 60 * 24 * 7,
          \})
    if ch_status(chan) !=# 'open'
      throw printf('Failed to connect `%s`', a:address)
    endif
    return chan
  endfunction

  function! s:notify(chan, method, params) abort
    return ch_sendraw(a:chan, json_encode([0, [a:method] + a:params]) . "\n")
  endfunction

  function! s:request(chan, method, params) abort
    let [ok, err] = ch_evalexpr(a:chan, [a:method] + a:params)
    if err isnot# v:null
      throw err
    endif
    return ok
  endfunction
endif
