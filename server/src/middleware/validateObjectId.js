import { ApiError } from '../utils/ApiError.js'

// Use with router.param('id', checkId). Strict 24-hex check (blocks odd 12-char strings and objects).
export const checkId = (req, res, next, value) =>
  /^[a-f\d]{24}$/i.test(String(value)) ? next() : next(new ApiError(400, 'Invalid ID'))
