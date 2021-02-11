function! denops#plugin#register(name, script) abort
  let exec = g:denops#plugin#deno_exec
  let args = get(g:denops#plugin#deno_args_map, a:name, g:denops#plugin#deno_args)
  return denops#server#request('register', a:name, [exec, 'run'] + args + [a:script])
endfunction

let g:denops#plugin#deno_exec = get(g:, 'denops#plugin#deno_exec', g:denops#server#deno_exec)
let g:denops#plugin#deno_args = get(g:, 'denops#plugin#deno_args', ['-q', '-r'])
let g:denops#plugin#deno_args_map = get(g:, 'denops#plugin#deno_args_map', {})
