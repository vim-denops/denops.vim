let s:file = expand('<sfile>:p')
let s:name = "denops-shared-server"
let s:unit_file = expand(printf('~/.config/systemd/user/%s.service', s:name))
let s:template_file = printf('%s/systemctl.template', fnamemodify(s:file, ':h'))

function! denops#shared_server#systemctl#install(options) abort
  let content = denops#util#render(readfile(s:template_file, 'b'), {
        \ 'deno': a:options.deno,
        \ 'denops': a:options.denops,
        \ 'hostname': a:options.hostname,
        \ 'port': a:options.port,
        \})
  call mkdir(dirname(s:unit_file), 'p')
  call writefile(content, s:unit_file)
  call system(printf('systemctl --user enable %s.service', s:name))
  call system(printf('systemctl --user start %s.service', s:name))
endfunction

function! denops#shared_server#systemctl#uninstall() abort
  call system(printf('systemctl --user stop %s.service', s:name))
  call system(printf('systemctl --user disable %s.service', s:name))
  call delete(s:unit_file)
  call system('systemctl daemon-reload')
  call system('systemctl reset-failed')
endfunction
