export class ApiError extends Error {
  constructor(status, message, { errors, code } = {}) {
    super(message)
    this.status = status
    this.errors = errors
    this.code = code
  }
}
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
