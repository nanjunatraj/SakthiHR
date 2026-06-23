/** @type {import('tailwindcss').Config} */
    module.exports = {
      darkMode: ["class"],
      content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./App.tsx"
      ],
      theme: {
        extend: {
          colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: {
              DEFAULT: 'hsl(221, 83%, 53%)',
              foreground: 'hsl(210, 40%, 98%)'
            },
            secondary: {
              DEFAULT: 'hsl(210, 40%, 96.1%)',
              foreground: 'hsl(222.2, 47.4%, 11.2%)'
            },
            accent: {
              DEFAULT: 'hsl(210, 40%, 96.1%)',
              foreground: 'hsl(222.2, 47.4%, 11.2%)'
            },
            card: {
              DEFAULT: 'hsl(0, 0%, 100%)',
              foreground: 'hsl(222.2, 47.4%, 11.2%)'
            },
            muted: {
              DEFAULT: 'hsl(210, 40%, 96.1%)',
              foreground: 'hsl(215.4, 16.3%, 46.9%)'
            }
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            serif: ['Lora', 'serif'],
          },
          boxShadow: {
            'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }
        }
      },
      plugins: [require("tailwindcss-animate")],
    };