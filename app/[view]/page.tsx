import { notFound } from 'next/navigation';
import { Workspace } from '@/components/workspace';
import type { View } from '@/lib/demo';
const views = ['ordens', 'clientes', 'equipamentos', 'agenda', 'orcamentos', 'servicos', 'produtos', 'relatorios', 'financeiro', 'configuracoes'];
export function generateStaticParams() { return views.map(view => ({ view })); }
export default async function Page({ params }: { params: Promise<{ view: string }> }) { const { view } = await params; if (!views.includes(view)) notFound(); return <Workspace view={view as View} />; }
