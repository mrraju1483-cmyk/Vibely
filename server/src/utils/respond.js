export const send = (res, status, message, data) =>
  res.status(status).json({ success: true, message, ...(data && { data }) })
