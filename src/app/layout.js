import "./globals.css";

export const metadata = {
  title: "Taça Pérolas do Vale do Itajaí • A&F Sincroniza",
  description: "Competição oficial (Futsal e Suíço) com inscrições, regulamento, painel do capitão e gestão administrativa.",
  metadataBase: new URL("https://afsincroniza-eventos.vercel.app"),
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
      <body>{children}</body>
    </html>
  );
}
