import { supabase } from './supabaseClient';

const BUCKET_NAME = 'job-photos';
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 0.7;
const THUMBNAIL_SIZE = 200;

/**
 * Compress an image file using canvas.
 * Returns a Blob (JPEG) that is much smaller than the original.
 */
const compressImage = (
  file: File | Blob,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
  quality = JPEG_QUALITY
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Scale down proportionally
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
};

/**
 * Generate a thumbnail blob from a file.
 */
const createThumbnail = (file: File | Blob): Promise<Blob> => {
  return compressImage(file, THUMBNAIL_SIZE, THUMBNAIL_SIZE, 0.6);
};

/**
 * Upload an image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 * Also uploads a smaller thumbnail alongside.
 */
export const uploadJobPhoto = async (
  file: File,
  userId: string
): Promise<{ url: string; thumbnailUrl: string }> => {
  // Compress the image before uploading
  const compressed = await compressImage(file);
  const thumbnail = await createThumbnail(file);

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${timestamp}_${safeName}`;
  const thumbPath = `${userId}/thumb_${timestamp}_${safeName}`;

  // Upload full image
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // Upload thumbnail
  const { error: thumbError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(thumbPath, thumbnail, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (thumbError) {
    console.warn('Thumbnail upload failed, using full image:', thumbError.message);
  }

  // Get public URLs
  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  const { data: thumbUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(thumbPath);

  return {
    url: urlData.publicUrl,
    thumbnailUrl: thumbError ? urlData.publicUrl : thumbUrlData.publicUrl,
  };
};

/**
 * Delete a photo from Supabase Storage by its public URL.
 */
export const deleteJobPhoto = async (publicUrl: string): Promise<void> => {
  // Extract path from URL: everything after /object/public/job-photos/
  const marker = `/object/public/${BUCKET_NAME}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return; // not a storage URL (might be legacy base64)

  const path = publicUrl.substring(idx + marker.length);
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
  if (error) console.error('Failed to delete photo:', error);

  // Also try to delete the thumbnail
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  const thumbPath = parts.slice(0, -1).join('/') + '/thumb_' + filename;
  await supabase.storage.from(BUCKET_NAME).remove([thumbPath]).catch(() => {});
};

/**
 * Check if a string is a base64 data URL (legacy format).
 */
export const isBase64Image = (str: string): boolean => {
  return str.startsWith('data:image/');
};

/**
 * Convert a legacy base64 image string to a Blob for re-upload.
 */
const base64ToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
};

/**
 * Migrate a base64 image to Supabase Storage.
 * Returns the new URL, or the original string if migration fails.
 */
export const migrateBase64ToStorage = async (
  base64Str: string,
  userId: string
): Promise<{ url: string; thumbnailUrl: string }> => {
  try {
    const blob = base64ToBlob(base64Str);
    const file = new File([blob], `migrated_${Date.now()}.jpg`, { type: 'image/jpeg' });
    return await uploadJobPhoto(file, userId);
  } catch (err) {
    console.error('Failed to migrate base64 image:', err);
    return { url: base64Str, thumbnailUrl: base64Str };
  }
};
