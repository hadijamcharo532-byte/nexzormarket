function errorHandler(err, _req, res, _next) {
  console.error(err);

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File is too large. Maximum size is 50MB per file.',
    });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
