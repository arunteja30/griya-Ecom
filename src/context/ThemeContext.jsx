import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useSiteSettings } from '../hooks/useRealtime';

const ThemeContext = createContext({});

export function ThemeProvider({ children }) {
  const { data: siteSettings } = useSiteSettings();

  const theme = useMemo(() => {
    // support both legacy flat keys and nested theme object
    const t = (siteSettings && siteSettings.theme) ? { ...siteSettings.theme } : {};
    // fallback to some top-level fields if present
    if (siteSettings) {
      if (!t.primary && siteSettings.primaryColor) t.primary = siteSettings.primaryColor;
      if (!t.accent && siteSettings.accentColor) t.accent = siteSettings.accentColor;
      if (!t.navBg && siteSettings.navBg) t.navBg = siteSettings.navBg;
      if (!t.footerBg && siteSettings.footerBg) t.footerBg = siteSettings.footerBg;
      if (!t.buttonBg && siteSettings.buttonBg) t.buttonBg = siteSettings.buttonBg;
      if (!t.siteBg && siteSettings.siteBg) t.siteBg = siteSettings.siteBg;
    }
    return t;
  }, [siteSettings]);

  useEffect(() => {
    // apply CSS variables to document root
    const root = document.documentElement;
    if (!theme) return;
    if (theme.primary) root.style.setProperty('--site-primary', theme.primary);
    if (theme.accent) root.style.setProperty('--site-accent', theme.accent);
    if (theme.navBg) root.style.setProperty('--site-nav-bg', theme.navBg);
    if (theme.footerBg) root.style.setProperty('--site-footer-bg', theme.footerBg);
    if (theme.buttonBg) root.style.setProperty('--site-button-bg', theme.buttonBg);
    if (theme.siteBg) root.style.setProperty('--site-bg', theme.siteBg);
    
    // product card specific colors
    if (theme.productCard) {
      const pc = theme.productCard;
      if (pc.cardBg) root.style.setProperty('--pc-card-bg', pc.cardBg);
      if (pc.name) root.style.setProperty('--pc-name', pc.name);
      if (pc.price) root.style.setProperty('--pc-price', pc.price);
      if (pc.star) root.style.setProperty('--pc-star', pc.star);
      if (pc.badgeNew) root.style.setProperty('--pc-badge-new', pc.badgeNew);
      if (pc.badgeBestseller) root.style.setProperty('--pc-badge-bestseller', pc.badgeBestseller);
      if (pc.badgeDiscount) root.style.setProperty('--pc-badge-discount', pc.badgeDiscount);
      if (pc.imageBg) root.style.setProperty('--pc-image-bg', pc.imageBg);
    }

    // small helper to pick readable text color (black or white) for a background color
    const parseRgb = (input) => {
      if (!input) return null;
      // hex - #rrggbb or #rgb
      const hexMatch = input.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) hex = hex.split('').map((c)=>c+c).join('');
        const r = parseInt(hex.substring(0,2),16);
        const g = parseInt(hex.substring(2,4),16);
        const b = parseInt(hex.substring(4,6),16);
        return [r,g,b];
      }
      // rgb(...) or rgba(...)
      const rgbMatch = input.match(/rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/i);
      if (rgbMatch) return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
      return null;
    };

    const contrastFor = (colorInput, dark='#111', light='#ffffff') => {
      const rgb = parseRgb(colorInput);
      if (!rgb) return light;
      const [r,g,b] = rgb;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128 ? dark : light;
    };

    // Derive readable text colors for nav/footer/button based on their backgrounds
    const btnBg = theme.buttonBg || theme.primary || null;
    const navBg = theme.navBg || null;
    const footerBg = theme.footerBg || null;
    root.style.setProperty('--site-button-text', contrastFor(btnBg));
    root.style.setProperty('--site-nav-text', contrastFor(navBg));
    root.style.setProperty('--site-footer-text', contrastFor(footerBg));
  }, [theme]);

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }

export default ThemeContext;
