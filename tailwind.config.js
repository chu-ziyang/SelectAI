/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // iOS-inspired color palette
        ios: {
          blue: '#007AFF',
          indigo: '#5856D6',
          green: '#34C759',
          orange: '#FF9500',
          red: '#FF3B30',
          pink: '#FF2D55',
          teal: '#5AC8FA',
          purple: '#AF52DE',
        },
        surface: {
          light: 'rgba(255, 255, 255, 0.72)',
          dark: 'rgba(28, 28, 30, 0.72)',
        },
      },
      backdropBlur: {
        ios: '20px',
      },
      boxShadow: {
        'ios-sm': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'ios-md': '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'ios-lg': '0 8px 30px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',
        'ios-xl': '0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        'ios': '13px',
        'ios-sm': '10px',
        'ios-lg': '20px',
      },
      animation: {
        'spring-in': 'springIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        springIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
