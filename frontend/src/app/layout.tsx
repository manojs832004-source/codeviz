import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

import { ThemeProvider } from '@/components/ThemeProvider';
export const metadata: Metadata = {
  title: 'AlgoViz — Algorithm Visualizer',
  description: 'Step-by-step algorithm visualization with memory inspection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 antialiased font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
