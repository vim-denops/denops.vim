local M = {}

local channel = 0

function M._set_channel(id)
  channel = id
end

function M.request(plugin, method, params)
  if vim.g["denops#disabled"] == 1 then
    return
  elseif channel == 0 then
    error("[denops] Channel is not ready yet")
  end
  return vim.rpcrequest(channel, "invoke", "dispatch", { plugin, method, params })
end

function M.notify(plugin, method, params)
  if vim.g["denops#disabled"] == 1 then
    return
  elseif channel == 0 then
    error("[denops] Channel is not ready yet")
  end
  vim.rpcnotify(channel, "invoke", "dispatch", { plugin, method, params })
end

return M
