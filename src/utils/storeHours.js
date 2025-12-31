// Store hours utility functions

export function isStoreOpen(siteSettings) {
  if (!siteSettings) return null; // Unknown state
  
  // Manual overrides take precedence
  if (siteSettings.storeManuallyOpen) return true;
  if (siteSettings.storeManuallyClosed) return false;
  
  // Check if we have store hours configured
  if (!siteSettings.storeOpenTime || !siteSettings.storeCloseTime || !siteSettings.storeOpenDays?.length) {
    return true; // If no hours set, assume always open
  }
  
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Check if today is an open day
  if (!siteSettings.storeOpenDays.includes(currentDay)) {
    return false;
  }
  
  // Parse open and close times
  const [openHour, openMin] = siteSettings.storeOpenTime.split(':').map(Number);
  const [closeHour, closeMin] = siteSettings.storeCloseTime.split(':').map(Number);
  
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  
  const currentTimeMinutes = currentHour * 60 + currentMin;
  const openTimeMinutes = openHour * 60 + openMin;
  const closeTimeMinutes = closeHour * 60 + closeMin;
  
  // Handle overnight hours (e.g., 10 PM to 6 AM)
  if (closeTimeMinutes < openTimeMinutes) {
    return currentTimeMinutes >= openTimeMinutes || currentTimeMinutes <= closeTimeMinutes;
  }
  
  // Normal day hours
  return currentTimeMinutes >= openTimeMinutes && currentTimeMinutes <= closeTimeMinutes;
}

export function getStoreStatus(siteSettings) {
  if (!siteSettings) return { isOpen: null, message: 'Loading...' };
  
  const isOpen = isStoreOpen(siteSettings);
  
  if (isOpen === null) {
    return { isOpen: null, message: 'Store status unknown' };
  }
  
  if (siteSettings.storeManuallyOpen) {
    return { isOpen: true, message: 'Open Now (Manual Override)' };
  }
  
  if (siteSettings.storeManuallyClosed) {
    return { isOpen: false, message: 'Temporarily Closed' };
  }
  
  if (!siteSettings.storeOpenTime || !siteSettings.storeCloseTime || !siteSettings.storeOpenDays?.length) {
    return { isOpen: true, message: 'Open Now' };
  }
  
  if (isOpen) {
    return { isOpen: true, message: `Open until ${formatTime(siteSettings.storeCloseTime)}` };
  } else {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (!siteSettings.storeOpenDays.includes(currentDay)) {
      // Find next open day
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayIndex = days.indexOf(currentDay);
      let nextOpenDay = null;
      
      for (let i = 1; i <= 7; i++) {
        const checkDay = days[(currentDayIndex + i) % 7];
        if (siteSettings.storeOpenDays.includes(checkDay)) {
          nextOpenDay = checkDay;
          break;
        }
      }
      
      return { 
        isOpen: false, 
        message: nextOpenDay ? `Closed - Opens ${nextOpenDay} at ${formatTime(siteSettings.storeOpenTime)}` : 'Closed'
      };
    } else {
      return { 
        isOpen: false, 
        message: `Closed - Opens at ${formatTime(siteSettings.storeOpenTime)}` 
      };
    }
  }
}

function formatTime(timeString) {
  if (!timeString) return '';
  const [hour, minute] = timeString.split(':');
  const h = parseInt(hour);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${minute} ${ampm}`;
}

export function getStoreHoursDisplay(siteSettings) {
  if (!siteSettings?.storeOpenTime || !siteSettings?.storeCloseTime || !siteSettings?.storeOpenDays?.length) {
    return null;
  }
  
  const openTime = formatTime(siteSettings.storeOpenTime);
  const closeTime = formatTime(siteSettings.storeCloseTime);
  const days = siteSettings.storeOpenDays;
  
  if (days.length === 7) {
    return `Daily ${openTime} - ${closeTime}`;
  }
  
  // Group consecutive days
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  
  if (sortedDays.length <= 3) {
    return `${sortedDays.join(', ')} ${openTime} - ${closeTime}`;
  }
  
  return `${sortedDays[0]} - ${sortedDays[sortedDays.length - 1]} ${openTime} - ${closeTime}`;
}