" ECMAScript like Promise library for asynchronous operations.
"   Spec: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
" This implementation is based upon es6-promise npm package.
"   Repo: https://github.com/stefanpenner/es6-promise
" This is an modified version of Async.Promise in vim-jp/vital.vim
"   Repo: https://github.com/vim-jp/vital.vim

" States of promise
let s:PENDING = 0
let s:FULFILLED = 1
let s:REJECTED = 2

let s:DICT_T = type({})

let s:TIMEOUT_ERROR = '[denops] Timeout'
let s:DEFAULT_WAIT_INTERVAL = 30

function! s:noop(...) abort
endfunction
let s:NOOP = funcref('s:noop')

" Internal APIs

let s:PROMISE = {
    \   '_state': s:PENDING,
    \   '_has_floating_child': v:false,
    \   '_children': [],
    \   '_fulfillments': [],
    \   '_rejections': [],
    \   '_result': v:null,
    \ }

let s:id = -1
function! s:_next_id() abort
  let s:id += 1
  return s:id
endfunction

function! s:_invoke_callback(settled, promise, callback, result, ...) abort
  let has_callback = a:callback isnot v:null
  let success = 1
  let err = v:null
  if has_callback
    try
      let l:Result = a:callback(a:result)
    catch
      let err = {
      \   'exception' : v:exception,
      \   'throwpoint' : v:throwpoint,
      \ }
      let success = 0
    endtry
  else
    let l:Result = a:result
  endif

  if a:promise._state != s:PENDING
    " Do nothing
  elseif has_callback && success
    call s:_resolve(a:promise, Result)
  elseif !success
    call s:_reject(a:promise, err)
  elseif a:settled == s:FULFILLED
    call s:_fulfill(a:promise, Result)
  elseif a:settled == s:REJECTED
    call s:_reject(a:promise, Result)
  endif
endfunction

function! s:_publish(promise, ...) abort
  let settled = a:promise._state
  if settled == s:PENDING
    throw '[denops]: Cannot publish a pending promise'
  endif

  if empty(a:promise._children)
    if settled == s:REJECTED && !a:promise._has_floating_child
      call s:_on_unhandled_rejection(a:promise._result)
    endif
    return
  endif

  for i in range(len(a:promise._children))
    if settled == s:FULFILLED
      let l:CB = a:promise._fulfillments[i]
    else
      " When rejected
      let l:CB = a:promise._rejections[i]
    endif
    let child = a:promise._children[i]
    if child isnot v:null
      call s:_invoke_callback(settled, child, l:CB, a:promise._result)
    else
      call l:CB(a:promise._result)
    endif
  endfor

  let a:promise._children = []
  let a:promise._fulfillments = []
  let a:promise._rejections = []
endfunction

function! s:_subscribe(parent, child, on_fulfilled, on_rejected) abort
  let a:parent._children += [ a:child ]
  let a:parent._fulfillments += [ a:on_fulfilled ]
  let a:parent._rejections += [ a:on_rejected ]
endfunction

function! s:_handle_thenable(promise, thenable) abort
  if a:thenable._state == s:FULFILLED
    call s:_fulfill(a:promise, a:thenable._result)
  elseif a:thenable._state == s:REJECTED
    call s:_reject(a:promise, a:thenable._result)
  else
    call s:_subscribe(
         \   a:thenable,
         \   v:null,
         \   funcref('s:_resolve', [a:promise]),
         \   funcref('s:_reject', [a:promise]),
         \ )
  endif
endfunction

function! s:_resolve(promise, ...) abort
  let l:Result = a:0 > 0 ? a:1 : v:null
  if s:is_promise(Result)
    call s:_handle_thenable(a:promise, Result)
  else
    call s:_fulfill(a:promise, Result)
  endif
endfunction

function! s:_fulfill(promise, value) abort
  if a:promise._state != s:PENDING
    return
  endif
  let a:promise._result = a:value
  let a:promise._state = s:FULFILLED
  if !empty(a:promise._children)
    call timer_start(0, funcref('s:_publish', [a:promise]))
  endif
endfunction

function! s:_reject(promise, ...) abort
  if a:promise._state != s:PENDING
    return
  endif
  let a:promise._result = a:0 > 0 ? a:1 : v:null
  let a:promise._state = s:REJECTED
  call timer_start(0, funcref('s:_publish', [a:promise]))
endfunction

function! s:_notify_done(wg, index, value) abort
  let a:wg.results[a:index] = a:value
  let a:wg.remaining -= 1
  if a:wg.remaining == 0
    call a:wg.resolve(a:wg.results)
  endif
endfunction

function! s:_all(promises, resolve, reject) abort
  let total = len(a:promises)
  if total == 0
    call a:resolve([])
    return
  endif

  let wait_group = {
      \   'results': repeat([v:null], total),
      \   'resolve': a:resolve,
      \   'remaining': total,
      \ }

  " 'for' statement is not available here because iteration variable is captured into lambda
  " expression by **reference**.
  call map(
       \   copy(a:promises),
       \   {i, p -> p.then({v -> s:_notify_done(wait_group, i, v)}, a:reject)},
       \ )
endfunction

function! s:_race(promises, resolve, reject) abort
  for p in a:promises
    call p.then(a:resolve, a:reject)
  endfor
endfunction

" Public APIs

function! s:new(resolver) abort
  let promise = deepcopy(s:PROMISE)
  let promise._vital_promise = s:_next_id()
  try
    if a:resolver != s:NOOP
      call a:resolver(
      \   funcref('s:_resolve', [promise]),
      \   funcref('s:_reject', [promise]),
      \ )
    endif
  catch
    call s:_reject(promise, {
    \   'exception' : v:exception,
    \   'throwpoint' : v:throwpoint,
    \ })
  endtry
  return promise
endfunction

function! s:all(promises) abort
  return s:new(funcref('s:_all', [a:promises]))
endfunction

function! s:race(promises) abort
  return s:new(funcref('s:_race', [a:promises]))
endfunction

function! s:resolve(...) abort
  let promise = s:new(s:NOOP)
  call s:_resolve(promise, a:0 > 0 ? a:1 : v:null)
  return promise
endfunction

function! s:reject(...) abort
  let promise = s:new(s:NOOP)
  call s:_reject(promise, a:0 > 0 ? a:1 : v:null)
  return promise
endfunction

function! s:is_promise(maybe_promise) abort
  return type(a:maybe_promise) == s:DICT_T && has_key(a:maybe_promise, '_vital_promise')
endfunction

function! s:wait(promise, ...) abort
  if a:0 && type(a:1) is# v:t_number
    let t = a:1
    let i = s:DEFAULT_WAIT_INTERVAL . 'm'
  else
    let o = a:0 ? a:1 : {}
    let t = get(o, 'timeout', v:null)
    let i = get(o, 'interval', s:DEFAULT_WAIT_INTERVAL) . 'm'
  endif
  let s = reltime()
  while a:promise._state is# s:PENDING
    if (t isnot# v:null && reltimefloat(reltime(s)) * 1000 > t)
      return [v:null, s:TIMEOUT_ERROR]
    endif
    execute 'sleep' i
  endwhile
  if a:promise._state is# s:FULFILLED
    return [a:promise._result, v:null]
  else
    return [v:null, a:promise._result]
  endif
endfunction

let s:_on_unhandled_rejection = s:NOOP
function! s:on_unhandled_rejection(on_unhandled_rejection) abort
  let s:_on_unhandled_rejection = a:on_unhandled_rejection
endfunction

function! s:_promise_then(...) dict abort
  let parent = self
  let state = parent._state
  let child = s:new(s:NOOP)
  let l:Res = a:0 > 0 ? a:1 : v:null
  let l:Rej = a:0 > 1 ? a:2 : v:null
  if state == s:FULFILLED
    let parent._has_floating_child = v:true
    call timer_start(0, funcref('s:_invoke_callback', [state, child, Res, parent._result]))
  elseif state == s:REJECTED
    let parent._has_floating_child = v:true
    call timer_start(0, funcref('s:_invoke_callback', [state, child, Rej, parent._result]))
  else
    call s:_subscribe(parent, child, Res, Rej)
  endif
  return child
endfunction
let s:PROMISE.then = funcref('s:_promise_then')

" .catch() is just a syntax sugar of .then()
function! s:_promise_catch(...) dict abort
  return self.then(v:null, a:0 > 0 ? a:1 : v:null)
endfunction
let s:PROMISE.catch = funcref('s:_promise_catch')

function! s:_on_finally(CB, parent, Result) abort
  call a:CB()
  if a:parent._state == s:FULFILLED
    return a:Result
  else " REJECTED
    return s:reject(a:Result)
  endif
endfunction
function! s:_promise_finally(...) dict abort
  let parent = self
  let state = parent._state
  let child = s:new(s:NOOP)
  if a:0 == 0
    let l:CB = v:null
  else
    let l:CB = funcref('s:_on_finally', [a:1, parent])
  endif
  if state != s:PENDING
    call timer_start(0, funcref('s:_invoke_callback', [state, child, CB, parent._result]))
  else
    call s:_subscribe(parent, child, CB, CB)
  endif
  return child
endfunction
let s:PROMISE.finally = funcref('s:_promise_finally')

" Export
function! denops#lib#promise#noop(...) abort
  return call('s:noop', a:000)
endfunction

function! denops#lib#promise#new(...) abort
  return call('s:new', a:000)
endfunction

function! denops#lib#promise#all(...) abort
  return call('s:all', a:000)
endfunction

function! denops#lib#promise#race(...) abort
  return call('s:race', a:000)
endfunction

function! denops#lib#promise#resolve(...) abort
  return call('s:resolve', a:000)
endfunction

function! denops#lib#promise#reject(...) abort
  return call('s:reject', a:000)
endfunction

function! denops#lib#promise#is_promise(...) abort
  return call('s:is_promise', a:000)
endfunction

function! denops#lib#promise#wait(...) abort
  return call('s:wait', a:000)
endfunction

function! denops#lib#promise#on_unhandled_rejection(...) abort
  return call('s:on_unhandled_rejection', a:000)
endfunction
