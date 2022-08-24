let s:file = expand('<sfile>:p')
let s:name = "io.github.vim-denops.LaunchAtLogin"
let s:plist_file = expand(printf('~/Library/LaunchAgents/%s.plist', s:name))
let s:template_file = printf('%s/launchctl.template', fnamemodify(s:file, ':h'))

function! denops#shared_server#launchctl#install(options) abort
  let content = denops#util#render(readfile(s:template_file, 'b'), {
        \ 'name': s:name,
        \ 'home': expand('~'),
        \ 'deno': a:options.deno,
        \ 'denops': a:options.denops,
        \ 'hostname': a:options.hostname,
        \ 'port': a:options.port,
        \})
  call denops#util#debug(printf('write plist content to `%s`', s:plist_file))
  call writefile(content, s:plist_file, 'b')
  call denops#util#debug(printf('load plist `%s`', s:plist_file))
  call system(printf('launchctl unload %s', s:plist_file))
  echo system(printf('launchctl load -w %s', s:plist_file))
endfunction

function! denops#shared_server#launchctl#uninstall() abort
  echo system(printf('launchctl unload %s', s:plist_file))
  call delete(s:plist_file)
endfunction
