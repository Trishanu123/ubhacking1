export interface PropertyPhoto { id: string; name: string; dataUrl: string }
export async function preparePropertyPhoto(file: File): Promise<PropertyPhoto> {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: maximum size is 10 MB.`);
  if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) && !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error(`${file.name}: use JPG, PNG, WebP or HEIC.`);
  let blob: Blob = file;
  if (/\.(heic|heif)$/i.test(file.name) || /heic|heif/.test(file.type)) {
    // Lazy loaded only for HEIC input; the WASM decoder is not part of initial page load.
    const { heicTo } = await import("heic-to/csp");
    blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.85 });
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 80000000) throw new Error("Image resolution is too large; choose a smaller photo.");
    const canvas = document.createElement("canvas");
    let side = 1280, quality = 0.82, dataUrl = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      const ratio = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext("2d"); if (!context) throw new Error("Your browser cannot process images. Try another browser or use manual entry.");
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Canvas encoding strips EXIF/GPS; no original image bytes leave the browser.
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= 330000) break;
      quality -= 0.08; side = Math.round(side * 0.9);
    }
    if (dataUrl.length > 330000) throw new Error("Unable to compress image enough; crop it and retry.");
    return { id: crypto.randomUUID(), name: file.name, dataUrl };
  } finally { URL.revokeObjectURL(url); }
}
