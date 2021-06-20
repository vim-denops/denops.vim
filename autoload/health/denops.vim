function! s:checkDenoVersion() abort
  let valid = 1
  " check deno is executable.
  let deno = get(g:, 'denops#deno')
  if !executable(deno)
    let valid = 0
    call health#report_error('Deno runtime is not installed. Please install deno and add to `$PATH`.')
    let deno_original = exepath('deno')
    if !executable(deno_original)
      call health#report_error('Deno runtime is not recognized by denops-core. Please check deno exists at the PATH. If it does and you think it is bug, please report to denops team.')
    endif
  endif
  " check deno version.
  let deno_version_output = system(deno . ' --version')
  if v:shell_error && deno_version_output !=# ""
    let valid = 0
    call health#report_error(deno_version_output)
  endif
  " split output
  let outputs = split(deno_version_output, '\n')
  " first line(deno version)
  let deno_versions = matchlist(outputs[0], '\vdeno (\d+).(\d+).(\d+) \((\w)+, (\w|-)+\)')
  if empty(deno_versions)
     let valid = 0
     call health#report_error('Unable to detect version of deno, make sure your deno runtime is correct.')
  elseif str2nr(deno_versions[1]) < 1 || str2nr(deno_versions[2] < 10)
    call health#report_warn('You should upgrade deno runtime since denops will use feature from `1.10.1`. See https://github.com/denoland/deno/pull/9323 for details.')
  elseif str2nr(deno_versions[1]) < 1 || str2nr(deno_versions[2] < 9)
    " TODO: Define minimum supported version of Deno.
     let valid = 0
    call health#report_error('You need to upgrade deno.')
  else
    call health#report_ok('Deno version check: passed')
    call health#report_info('Deno version: ' . outputs[0])
  endif
  return valid
endfunction

function! s:checkEnvironment() abort
  if has('nvim')
    " TODO: check nvim version
    call health#report_ok('Neovim version check: passed')
    return 0
    " call health#report_error('Invalid Neovim version. nvim xxx or above required')
  elseif has('vim')
    " TODO: check Vim version
    " call health#report_error('Invalid Vim version. nvim xxx or above required')
    call health#report_ok('Vim version check: passed')
    return 0
  else
    call health#report_error('You are using invalid editor. Please use supported version Vim or Neovim.')
    return 1
  endif
endfunction

function! s:checkDenops() abort
  let mode = 'production'
  if get(g:, 'denops#debug', 0)
    let mode = 'debug'
  endif
  let denops_version = get(g:, 'denops#version', "0.0")

  call health#report_info('Denops.vim ' . denops_version . ' (' . mode . ')')
endfunction

function! s:checkDenopsRunning() abort
  let server_status = denops#server#status()
  if (server_status == 'running')
    call health#report_ok('Denops.vim is running')
  elseif(server_status == 'stopped')
    call health#report_error('Denops.vim is now stopped, please call `denops#server#start()` manually if needed for debugging.')
  else
    call health#report_error('Denops.vim may not exist or not loaded correctly.')
  endif
endfunction

function! health#denops#check() abort
  call s:checkEnvironment()
  call s:checkDenoVersion()
  call s:checkDenopsRunning()
  call s:checkDenops()
endfunction
