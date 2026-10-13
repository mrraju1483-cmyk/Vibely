import { ApiError } from '../utils/ApiError.js'

export const notFound = (req, res, next) => next(new ApiError(404, 'Route not found'))

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500
  let message = 'Something went wrong on our side'
  let errors
  let code

  if (err instanceof ApiError) {
    ;({ status, message, errors, code } = err)
  } else if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value'
    status = 409
    message = `That ${field} is already in use`
    errors = { [field]: message }
  } else if (err?.name === 'ValidationError') {
    status = 400
    message = 'Validation failed'
    errors = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]))
  } else if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    status = 400
    message = 'Invalid request body'
  } else if (err?.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Invalid upload'
    errors = { media: message }
  } else {
    console.error('Unhandled error:', err?.message) // never sent to the client
  }
  res.status(status).json({ success: false, message, ...(errors && { errors }), ...(code && { code }) })
}
