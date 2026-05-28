import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-g-border/40 py-5 text-center">
        <p className="text-g-muted text-xs font-mono">
          Built on{' '}
          <a href="https://ton.org" target="_blank" rel="noopener noreferrer"
            className="text-g-blue hover:underline">TON Blockchain</a>
          {' '}· TEP-62 Standard
        </p>
      </footer>
    </div>
  );
}
