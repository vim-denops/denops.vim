function denops#_internal#event#emit(name) abort
  execute 'doautocmd <nomodeline> User' a:name
endfunction
