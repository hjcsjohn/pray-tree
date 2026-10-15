import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '기도나무 | Pray Tree', description: '함께 기도하고 응답을 기록하는 기도나무' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
