/** PactLedger design tokens — notarial ledger theme.
 *  Ink + parchment + wax seal + brass. No gradients-as-decoration. */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        ink: "#12140F",
        ink2: "#1A1E17",
        ink3: "#232820",
        parchment: "#ECE7D6",
        parchdim: "#B9B29C",
        seal: "#AE3226",
        sealdeep: "#7E2118",
        pine: "#3FA46F",
        pinedeep: "#1E4A36",
        brass: "#C29B3C",
        brassdeep: "#7A5F1E",
        sage: "#7D8B7A",
      },
      fontFamily: {
        display: ["Spectral", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
