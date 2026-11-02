import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { Language } from '../i18n';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { HomeScreen } from '../features/home/HomeScreen';
import { BillingScreen } from '../features/billing/BillingScreen';
import { InventoryScreen } from '../features/inventory/InventoryScreen';
import { InterestScreen } from '../features/interest/InterestScreen';
import { LedgerScreen } from '../features/ledger/LedgerScreen';
import { CustomerStatementScreen } from '../features/ledger/CustomerStatementScreen';
import { BillHistoryScreen } from '../features/receipts/BillHistoryScreen';
import { PublicReceiptScreen } from '../features/receipts/PublicReceiptScreen';
import { ReportsScreen } from '../features/reports/ReportsScreen';

function AppLayout({
  children,
  language,
  onToggleLanguage,
}: {
  children: React.ReactNode;
  language: Language;
  onToggleLanguage: () => void;
}) {
  const location = useLocation();
  const isPublicReceipt =
    location.pathname.startsWith('/r/') || location.pathname.startsWith('/bill/');

  if (isPublicReceipt) {
    return <main>{children}</main>;
  }

  return (
    <div className="min-h-screen bg-mk-bg text-mk-text font-devanagari antialiased flex flex-col justify-between">
      <div className="w-full max-w-md mx-auto bg-white min-h-screen shadow-lg relative flex flex-col">
        <Header language={language} onToggleLanguage={onToggleLanguage} />
        <main className="flex-1">{children}</main>
        <BottomNav language={language} />
      </div>
    </div>
  );
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('munsi_lang') as Language) || 'hi';
  });

  const handleToggleLanguage = () => {
    const next: Language = language === 'hi' ? 'en' : 'hi';
    setLanguage(next);
    localStorage.setItem('munsi_lang', next);
  };

  return (
    <BrowserRouter>
      <AppLayout language={language} onToggleLanguage={handleToggleLanguage}>
        <Routes>
          <Route path="/" element={<HomeScreen language={language} />} />
          <Route path="/billing" element={<BillingScreen language={language} />} />
          <Route path="/inventory" element={<InventoryScreen language={language} />} />
          <Route path="/interest" element={<InterestScreen language={language} />} />
          <Route path="/ledger" element={<LedgerScreen language={language} />} />
          <Route path="/ledger/:customerId" element={<CustomerStatementScreen language={language} />} />
          <Route path="/bills" element={<BillHistoryScreen language={language} />} />
          <Route path="/bills/:id" element={<BillHistoryScreen language={language} />} />
          <Route path="/reports" element={<ReportsScreen language={language} />} />
          <Route path="/settings" element={<ReportsScreen language={language} />} />
          {/* Public customer invoice links */}
          <Route path="/r/:shareToken" element={<PublicReceiptScreen />} />
          <Route path="/bill/:id" element={<PublicReceiptScreen />} />
          {/* Fallback */}
          <Route path="*" element={<HomeScreen language={language} />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;

