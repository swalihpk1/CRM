const multer = require('multer');

// memoryStorage: files are read directly as Buffer (contents), matching
// Python's `await file.read()` in-memory handling — no temp files on disk.
const upload = multer({ storage: multer.memoryStorage() });

module.exports = upload;
