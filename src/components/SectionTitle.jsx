import React from "react";

export default function SectionTitle({ 
  title, 
  subtitle, 
  align = "left", 
  className = "",
  showDecorator = true 
}) {
  return (
    <div className={`mb-12 ${align === "center" ? "text-center" : ""} ${className}`}>
      {showDecorator && (
        <div className={`w-20 h-1 bg-accent-600 rounded-full mb-6 ${
          align === "center" ? "mx-auto" : ""
        }`}></div>
      )}
      <h2 className="section-title">{title}</h2>
      {subtitle && (
        <p className="section-subtitle mt-4">{subtitle}</p>
      )}
    </div>
  );
}
