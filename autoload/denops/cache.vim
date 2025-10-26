const s:root = expand('<sfile>:p:h:h:h')
const s:mod = denops#_internal#path#join([s:root, 'denops', '@denops-private', 'mod.ts'])
let s:job = v:null

function! denops#cache#update(...) abort
  const l:options = extend(#{ reload: v:false }, a:0 ? a:1 : {})
  const l:plugins = denops#_internal#plugin#list()
  const l:entryfiles = extend([s:mod], mapnew(l:plugins, { _, v -> v.script }))

  let l:args = [g:denops#deno, 'cache']

  if l:options.reload
    let l:args = add(l:args, '--reload')
    echomsg '[denops] Forcibly update cache of the following files.'
  else
    echomsg '[denops] Update cache of the following files. Call `denops#cache#update(#{reload: v:true})` to forcibly update.'
  endif

  for l:entryfile in l:entryfiles
    echomsg printf('[denops] %s', l:entryfile)
  endfor
  let l:args = extend(l:args, l:entryfiles)

  let s:job = denops#_internal#job#start(l:args, #{
        \ on_stderr: funcref('s:on_stderr'),
        \ on_exit: funcref('s:on_exit'),
        \ env: #{
        \   NO_COLOR: 1,
        \   DENO_NO_PROMPT: 1,
        \ },
        \})
  call denops#_internal#wait#for(60 * 1000, { -> s:job is# v:null }, 100)
  echomsg '[denops] Deno cache is updated.'
endfunction

function! s:on_stderr(job, data, event) abort
  echohl Comment
  for l:line in split(a:data, '\n')
    echomsg printf('[denops] %s', substitute(l:line, '\t', '    ', 'g'))
  endfor
  echohl None
endfunction

function! s:on_exit(job, status, event) abort
  let s:job = v:null
endfunction
