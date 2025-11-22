
export function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  const u = url.trim();

  // Already canonical direct-view URL
  if (u.includes("drive.google.com/uc?export=view")) return u;

  // drive.usercontent download?id=FILEID
  let m = u.match(/drive\.usercontent\.google\.com\/download\?id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

  // Google Drive /file/d/FILEID/view
  m = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

  // drive.google.com/open?id=FILEID
  m = u.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

  // fallback: any id=FILEID param on a drive URL
  m = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && (u.includes("drive.google.com") || u.includes("drive.usercontent.google.com"))) {
    return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  }

  return u;
}
