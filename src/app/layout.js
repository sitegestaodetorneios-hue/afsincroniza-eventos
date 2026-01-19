import "./globals.css";
// ✅ IMPORTA O RASTREADOR
import UserTracker from '@/components/UserTracker';

export const metadata = {
  title: "Taça Pérolas do Vale do Itajaí • A&F Sincroniza",
  description: "Competição oficial (Futsal e Suíço) com inscrições, regulamento, painel do capitão e gestão administrativa.",
  metadataBase: new URL("https://afsincroniza-eventos.vercel.app"),

  // ✅ PWA / Manifest
  manifest: "/site.webmanifest",

  // ✅ Ícones (aba + iOS)
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ],
    shortcut: ["/favicon.ico"]
  },

  openGraph: {
    title: "Taça Pérolas do Vale do Itajaí",
    description: "Inscrições, regulamento e acompanhamento da competição.",
    url: "https://afsincroniza-eventos.vercel.app",
    siteName: "afsincroniza-eventos",
    locale: "pt_BR",
    type: "website"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body>
        {/* ✅ O ESPIÃO FICA AQUI, INVISÍVEL, MONITORANDO TUDO */}
        <UserTracker />
        {children}
      </body>
    </html>
  );
}
