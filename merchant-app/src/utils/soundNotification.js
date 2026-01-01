// Sound notification utility for merchant app

export class SoundNotification {
  
  // Play notification sound based on type
  static playNotificationSound(type = 'default', volume = 0.3) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      switch (type) {
        case 'new_order':
        case 'urgent':
          this.playUrgentSound(audioContext, volume);
          break;
          
        case 'success':
        case 'order_completed':
          this.playSuccessSound(audioContext, volume);
          break;
          
        case 'payment':
        case 'payment_received':
          this.playPaymentSound(audioContext, volume);
          break;
          
        case 'warning':
        case 'order_cancelled':
          this.playWarningSound(audioContext, volume);
          break;
          
        case 'message':
        case 'chat':
          this.playMessageSound(audioContext, volume);
          break;
          
        default:
          this.playDefaultSound(audioContext, volume);
      }
      
    } catch (error) {
      console.log('Audio notification not supported:', error);
      // Fallback to system notification if available
      this.playFallbackSound();
    }
  }

  // Urgent notification sound - multiple beeps, higher pitch
  static playUrgentSound(audioContext, volume) {
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    
    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);
    
    oscillator1.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator1.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator1.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
    
    gainNode1.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.4);
    
    // Second beep after a pause
    setTimeout(() => {
      if (audioContext.state !== 'closed') {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.frequency.value = 1000;
        gainNode2.gain.setValueAtTime(volume * 0.8, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator2.start();
        oscillator2.stop(audioContext.currentTime + 0.3);
      }
    }, 200);
  }

  // Success notification sound - ascending musical notes
  static playSuccessSound(audioContext, volume) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // C-E-G major chord progression
    oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  // Payment notification sound - pleasant coin-like sound
  static playPaymentSound(audioContext, volume) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.05);
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  }

  // Warning notification sound - lower pitch, warbling
  static playWarningSound(audioContext, volume) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(350, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2);
    oscillator.frequency.setValueAtTime(350, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  }

  // Message notification sound - gentle double beep
  static playMessageSound(audioContext, volume) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.25);
  }

  // Default notification sound
  static playDefaultSound(audioContext, volume) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  }

  // Fallback for when Web Audio API is not available
  static playFallbackSound() {
    // Try to use the Notification API sound
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('', {
          body: '',
          silent: false,
          icon: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        });
        setTimeout(() => notification.close(), 1);
      }
    } catch (error) {
      console.log('Fallback sound notification failed');
    }
  }

  // Play vibration along with sound for mobile devices
  static vibrate(pattern = [100, 50, 100]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // Play urgent notification with sound and vibration
  static playUrgentAlert() {
    this.playNotificationSound('urgent', 0.4);
    this.vibrate([200, 100, 200, 100, 200]);
  }

  // Play success feedback
  static playSuccess() {
    this.playNotificationSound('success', 0.3);
    this.vibrate([100]);
  }

  // Play payment received sound
  static playPaymentReceived() {
    this.playNotificationSound('payment', 0.3);
    this.vibrate([150, 50, 150]);
  }
}