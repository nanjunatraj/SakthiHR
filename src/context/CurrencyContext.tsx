import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSavedCurrencyCode, saveCurrencyCode, getCurrencySymbol, CURRENCIES, type CurrencyOption } from '../utils/currency';

interface CurrencyContextValue {
  currencyCode: string;
  currencySymbol: string;
  setCurrency: (code: string) => void;
  formatAmount: (amount: number) => string;
  currencies: CurrencyOption[];
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currencyCode: 'INR',
  currencySymbol: '₹',
  setCurrency: () => {},
  formatAmount: (n) => `₹${n}`,
  currencies: CURRENCIES,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState<string>(getSavedCurrencyCode);

  const currencySymbol = getCurrencySymbol(currencyCode);

  const setCurrency = useCallback((code: string) => {
    saveCurrencyCode(code);
    setCurrencyCode(code);
  }, []);

  const formatAmount = useCallback((amount: number): string => {
    const symbol = getCurrencySymbol(currencyCode);
    if (amount >= 10000000) return `${symbol}${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `${symbol}${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `${symbol}${(amount / 1000).toFixed(0)}K`;
    return `${symbol}${amount.toLocaleString('en-IN')}`;
  }, [currencyCode]);

  return (
    <CurrencyContext.Provider value={{ currencyCode, currencySymbol, setCurrency, formatAmount, currencies: CURRENCIES }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}