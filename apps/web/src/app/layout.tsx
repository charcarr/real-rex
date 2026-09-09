import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Real Rex',
  description: 'Send your five best spots.',
};

// No next/font here on purpose. The create-next-app template loaded Geist via
// next/font/google, which injects a generated class name onto <html>. That was
// the only value on this element that could differ between the server render
// and the client render, and it was producing a hydration mismatch warning in
// dev. Typography is a design decision we have not made yet, so the simplest
// correct thing is to ship no webfont at all until we choose one.
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
