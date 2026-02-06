/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        fluxBlue: "#00CDFE"
      },
      fontFamily: {
        sans: ["system-ui", "ui-sans-serif", "SF Pro Text", "Inter", "sans-serif"],
        mono: ["SF Mono", "ui-monospace", "Menlo", "Monaco", "Consolas", "Liberation Mono", "monospace"]
      },
      boxShadow: {
        "flux-card": "0 18px 45px rgba(0, 0, 0, 0.45)"
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem"
      }
    }
  },
  plugins: []
};
