/**
 * Client-Side Wholesale Bill Photo Compression
 * Uses HTML5 Canvas to strip EXIF, resize, and compress images to ~100 KB - 300 KB
 */

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  width: number;
  height: number;
}

export async function compressWholesalePhoto(
  file: File,
  maxDimension = 1400,
  quality = 0.75
): Promise<CompressedImageResult> {
  // Validate type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('कृपया केवल JPG, PNG या WebP फोटो अपलोड करें');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('फोटो लोड करने में त्रुटि हुई'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('अमान्य इमेज फाइल'));
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        // Scale proportionally if exceeds maxDimension
        if (w > maxDimension || h > maxDimension) {
          if (w > h) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          } else {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Draw image onto canvas (clearing metadata)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('इमेज कंप्रेस करने में त्रुटि'));
              return;
            }

            const compressedFile = new File([blob], `wholesale_${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });

            const dataUrl = canvas.toDataURL('image/jpeg', quality);

            resolve({
              file: compressedFile,
              dataUrl,
              originalSizeBytes: file.size,
              compressedSizeBytes: blob.size,
              width: w,
              height: h,
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

