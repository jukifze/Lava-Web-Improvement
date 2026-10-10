export async function uploadImage(file) {
  if (!file) throw new Error('Pilih gambar yang akan diunggah.');
  if (typeof file === 'string') {
    try { const url = new URL(file); if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com') return url.href; } catch {}
    throw new Error('Gambar harus berupa URL Cloudinary yang aman.');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Gunakan JPG, PNG, atau WebP maksimal 10 MB.');
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) throw new Error('Upload Cloudinary belum dikonfigurasi.');
  const body = new FormData(); body.append('file', file); body.append('upload_preset', preset);
  let response;
  try { response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body }); }
  catch { throw new Error('Upload gagal. Periksa koneksi dan coba lagi.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url) throw new Error('Upload Cloudinary gagal. Gambar belum disimpan; silakan coba lagi.');
  return uploadImage(result.secure_url);
}
