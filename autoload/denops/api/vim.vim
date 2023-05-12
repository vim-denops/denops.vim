if !has('vim9script')
  " NOTE:
  " This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
  " above SILENCE any errors occurred in `call` channel command.
  " https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
  function! denops#api#vim#call(fn, args) abort
    try
      let l:result = call(a:fn, a:args)
      if g:denops#debug
        " Check if the result is serializable
        call json_encode(l:result)
      endif
      return [l:result, '']
    catch
      return [v:null, v:exception . "\n" . v:throwpoint]
    endtry
  endfunction

  " NOTE:
  " This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
  " above SILENCE any errors occurred in `call` channel command.
  " https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
  function! denops#api#vim#batch(calls) abort
    let l:results = []
    try
      for l:Call in a:calls
        call add(l:results, call(l:Call[0], l:Call[1:]))
      endfor
      if g:denops#debug
        " Check if the result is serializable
        call json_encode(l:results)
      endif
      return [l:results, '']
    catch
      return [l:results, v:exception . "\n" . v:throwpoint]
    endtry
  endfunction
else
  " NOTE:
  " This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
  " above SILENCE any errors occurred in `call` channel command.
  " https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
  def denops#api#vim#call(fn: any, args: list<any>): list<any>
    try
      var result = call(fn, args)
      if g:denops#debug
        # Check if the result is serializable
        json_encode(result)
      endif
      return [result, '']
    catch
      return [null, v:exception .. "\n" .. v:throwpoint]
    endtry
  enddef

  " NOTE:
  " This is a workaround function to detect errors in Vim while Vim 8.2.3081 or
  " above SILENCE any errors occurred in `call` channel command.
  " https://github.com/vim/vim/commit/11a632d60bde616feb298d180108819ebb1d04a0
  def denops#api#vim#batch(calls: list<any>): list<any>
    var results = []
    try
      for call_item in calls
        add(results, call(call_item[0], slice(call_item, 1)))
      endfor
      if g:denops#debug
        # Check if the result is serializable
        json_encode(results)
      endif
      return [results, '']
    catch
      return [results, v:exception .. "\n" .. v:throwpoint]
    endtry
  enddef
endif
