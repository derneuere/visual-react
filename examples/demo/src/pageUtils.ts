/**
 * Regex that matches paths ending with common static file extensions.
 * Used to prevent the catch-all route from treating asset requests as page paths.
 */
export const STATIC_FILE_PATTERN =
  /\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|eot|map|json|txt|xml|pdf)$/i;
