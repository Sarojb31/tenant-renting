import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface Props { children: ReactNode; title: string }

export function Layout({ children, title }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-gray-100 px-8 py-4 shrink-0">
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        </header>
        <main className="flex-1 px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
