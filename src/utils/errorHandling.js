// Global error handler for async promise rejections
window.addEventListener('unhandledrejection', function(event) {
  // Check if it's a browser extension related error
  if (event.reason?.message?.includes('message channel closed') || 
      event.reason?.message?.includes('Extension context invalidated')) {
    // Suppress browser extension errors
    event.preventDefault();
    console.log('Suppressed browser extension error:', event.reason?.message);
    return;
  }
  
  // Log other unhandled promise rejections for debugging
  console.error('Unhandled promise rejection:', event.reason);
});

// Global error handler for regular errors
window.addEventListener('error', function(event) {
  // Check if it's a browser extension related error
  if (event.message?.includes('message channel closed') || 
      event.message?.includes('Extension context invalidated')) {
    // Suppress browser extension errors
    event.preventDefault();
    console.log('Suppressed browser extension error:', event.message);
    return;
  }
  
  // Log other errors for debugging
  console.error('Global error:', event.error);
});

export default {};