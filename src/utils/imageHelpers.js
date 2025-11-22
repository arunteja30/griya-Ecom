export function normalizeImageUrl(url){
  if(!url || typeof url !== 'string') return url;
  // Google Drive share/view URL -> convert to uc?export=view
  const m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if(m){
    return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  }
  // handle open?id=FILEID
  const m2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if(m2){
    return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
  }
  // handle shared link with id= param
  const m3 = url.match(/id=([a-zA-Z0-9_-]+)/);
  if(m3 && url.includes('drive.google.com')){
    return `https://drive.google.com/uc?export=view&id=${m3[1]}`;
  }
    // handle drive.usercontent download?id=FILEID
  const m4 = url.match(/drive\.usercontent\.google\.com\/download\?id=([a-zA-Z0-9_-]+)/);
  if (m4) return `https://drive.google.com/uc?export=view&id=${m4[1]}`;
  return url;
}
