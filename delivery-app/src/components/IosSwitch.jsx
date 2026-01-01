import React from 'react'

// Simple iOS-like switch. Props:
// - checked: boolean
// - onChange: function(newChecked)
// - id: optional id
// - disabled: optional
export default function IosSwitch({ checked, onChange, id, disabled }) {
  const handleKey = (e) => {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onChange(!checked)
    }
  }

  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      tabIndex={0}
      onKeyDown={handleKey}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex items-center transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-400 ${
        checked ? 'bg-primary-500' : 'bg-surface-300'
      } rounded-full p-0.5 h-7 w-12`}
    >
      <span
        className={`bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out h-6 w-6 inline-block ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
