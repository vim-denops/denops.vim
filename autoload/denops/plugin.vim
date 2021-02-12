function! denops#plugin#register(name, script) abort
  let exec = g:denops#plugin#deno_exec
  let args = get(g:denops#plugin#deno_args_map, a:name, g:denops#plugin#deno_args)
  let args = [exec, 'run'] + args + [a:script]
  call denops#server#notify('register', [a:name, args])
endfunction

let g:denops#plugin#deno_exec = get(g:, 'denops#plugin#deno_exec', g:denops#server#deno_exec)
let g:denops#plugin#deno_args = get(g:, 'denops#plugin#deno_args', ['-q'])
let g:denops#plugin#deno_args_map = get(g:, 'denops#plugin#deno_args_map', {})
