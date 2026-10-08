const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Choose a JPG, PNG, WebP, or AVIF image.'
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Images must be 5 MB or smaller.'
  }

  return null
}