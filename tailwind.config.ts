import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    "./client/**/*.{js,ts,jsx,tsx}",
    "./public/index.html",
    "./server/**/*.ts",
    "./shared/**/*.ts"
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Alex Brush"', 'cursive'],
        body: ['"Playfair Display"', 'serif']
      },
      colors: {
        pink: {
          DEFAULT: "#FF69B4",
          dark: "#CE2186"
        },
        gold: {
          DEFAULT: "#FFD700",
        },
        celestial: "#1b1523",
        black: "#000000",
        white: "#ffffff"
      },
      backgroundImage: {
        'celestial': "url('https://i.postimg.cc/sXdsKGTK/DALL-E-2025-06-06-14-36-29-A-vivid-ethereal-background-image-designed-for-a-psychic-reading-app.webp')"
      },
      boxShadow: {
        glow: "0 0 30px 10px rgba(255,105,180,0.4)",
      },
      animation: {
        'fade-in': "fadeIn 1s ease-in",
        'pulse-gold': "pulseGold 2s infinite"
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 }
        },
        pulseGold: {
          '0%,100%': { boxShadow: '0 0 10px 2px #FFD700' },
          '50%': { boxShadow: '0 0 30px 10px #FFD700' }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
} satisfies Config