import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
import Home from './pages/Home';
import Create from './pages/Create';
import Mint from './pages/Mint';

export default function App() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/create" element={<Create />} />
          <Route path="/mint/:address" element={<Mint />} />
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
              <p className="text-4xl font-bold text-g-white font-mono">404</p>
              <p className="text-g-muted">Page not found</p>
              <a href="/" className="btn-secondary mt-2">Go Home</a>
            </div>
          } />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}
