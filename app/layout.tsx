import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import './globals.css';
import { DemoProvider } from '@/components/demo-provider';
export const metadata: Metadata = { title: 'Nexo · Gestão da assistência', description: 'Protótipo navegável do Atendimento 2. Clientes, equipamentos e serviços em um só lugar.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body><DemoProvider>{children}</DemoProvider></body></html>; }
