import multer from 'multer'

// Memory storage: the file is validated (real type + size) before anything is written anywhere.
// Shared by posts and stories.
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 10, fieldSize: 20 * 1024 },
})
