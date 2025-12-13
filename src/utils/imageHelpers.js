
// Smart Google Drive URL converter for gallery images
export function normalizeImageUrl(url) {
  // console.log(`Normalizing image URL: ${url}`);
  if (!url) return '';

  // Check if it's a Google Drive link
  if (url.includes('drive.google.com') || url.includes('drive.usercontent.google.com')) {
      // Extract file ID from various Google Drive URL formats
        let fileId = '';
        
        if (url.includes('drive.usercontent.google.com/download?id=')) {
            // Format: https://drive.usercontent.google.com/download?id=FILE_ID&authuser=0
            const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match) fileId = match[1];
        } else if (url.includes('/file/d/')) {
            // Format: https://drive.google.com/file/d/FILE_ID/view
            const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (match) fileId = match[1];
        } else if (url.includes('id=')) {
            // Generic format with id parameter
            const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match) fileId = match[1];
        }
        
        // Validate and fix file ID if needed
        if (fileId) {
            // Google Drive file IDs should typically be 28+ characters and start with '1'
            // If it doesn't start with '1' and looks like it's missing it, add it
            if (fileId.length >= 20 && !fileId.startsWith('1') && 
                fileId.match(/^[A-Za-z0-9_-]+$/) && 
                (fileId.startsWith('A') || fileId.startsWith('B') || fileId.startsWith('C'))) {
                console.log(`🔧 Auto-fixing Google Drive file ID: ${fileId} -> 1${fileId}`);
                fileId = '1' + fileId;
            }
            
            // console.log(`🔗 Converting Google Drive URL: ${url} -> file ID: ${fileId}`);
            // const finalUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
            const url1 = `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
            // console.log(`🔗 thumbnail URL: ${url1}`);

            return url1;
        } else {
            // console.warn(`⚠️ Could not extract file ID from Google Drive URL: ${url}`);
        }
    }
    
    // If not a Google Drive link or conversion failed, return original URL
    // This handles direct image URLs (http/https ending in image extensions)
    return url;
}
