import "./globals.css";

export const metadata = {
  title: "Realtime Chat",
  description: "A realtime chat website built with Next.js, Tailwind CSS, Node.js, and Socket.IO"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
