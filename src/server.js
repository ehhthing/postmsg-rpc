export default function expose (funcName, func, opts) {
  opts = opts || {}

  const addListener = opts.addListener || window.addEventListener
  const removeListener = opts.removeListener || window.removeEventListener
  const postMessage = opts.postMessage || window.postMessage
  const targetOrigin = opts.targetOrigin || '*'
  const getMessageData = opts.getMessageData || ((event) => event.data)
  const isCallback = opts.isCallback || false
  const allowOrigins = opts.allowOrigins || ((origin) => true)

  const handler = function () {
    if (!allowOrigins(arguments[1])) {
      throw new Error("Origin not allowed");
    }
    const data = getMessageData.apply(null, arguments)
    if (!data) return
    if (data.sender !== 'postmsg-rpc/client' || data.func !== funcName) return

    const msg = { sender: 'postmsg-rpc/server', id: data.id }

    const onSuccess = (res) => {
      msg.res = res
      postMessage(msg, targetOrigin)
    }

    const onError = (err) => {
      msg.err = Object.assign({ message: err.message }, err.output && err.output.payload)

      if (process.env.NODE_ENV !== 'production') {
        msg.err.stack = msg.err.stack || err.stack
      }

      postMessage(msg, targetOrigin)
    }

    if (isCallback) {
      func.apply(null, data.args.concat((err, res) => {
        if (err) return onError(err)
        onSuccess(res)
      }))
    } else {
      const res = func.apply(null, data.args)
      Promise.resolve(res).then(onSuccess).catch(onError)
    }
  }

  addListener('message', handler)

  return { close: () => removeListener('message', handler) }
}
