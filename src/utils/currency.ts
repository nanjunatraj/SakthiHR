export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
];

const CURRENCY_STORAGE_KEY = 'hrms_currency_code';

export function getSavedCurrencyCode(): string {
  try {
    return localStorage.getItem(CURRENCY_STORAGE_KEY) ?? 'INR';
  } catch {
    return 'INR';
  }
}

export function saveCurrencyCode(code: string): void {
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

export function getCurrencySymbol(code?: string): string {
  const resolvedCode = code ?? getSavedCurrencyCode();
  return CURRENCIES.find(c => c.code === resolvedCode)?.symbol ?? '₹';
}

export function formatCurrency(amount: number, code?: string): string {
  const symbol = getCurrencySymbol(code);
  if (amount >= 10000000) return `${symbol}${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `${symbol}${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${symbol}${(amount / 1000).toFixed(0)}K`;
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}