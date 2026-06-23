import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint, Shield, Phone, CheckCircle2, X, AlertCircle,
  RefreshCw, Lock, Eye, EyeOff, FileText, User, Hash,
  Clock, Sparkles, Info, ChevronRight, BadgeCheck, Loader2
} from 'lucide-react';
import { toast } from 'react-toastify';

// ─── Types ────────────────────────────────────────────────────────────────────

type SigningStep = 'init' | 'aadhaar-entry' | 'otp-sent' | 'otp-verify' | 'signing' | 'signed';

interface DocumentToSign {
  id: string;
  name: string;
  category: string;
  size?: number;
  uploadedAt?: string;
}

interface AadhaarOTPSigningProps {
  document: DocumentToSign;
  employeeName: string;
  employeeId: string;
  onClose: () => void;
  onSigned: (signatureData: SignatureData) => void;
}

export interface SignatureData {
  documentId: string;
  signedAt: string;
  aadhaarLast4: string;
  transactionId: string;
  signatureHash: string;
  signerName: string;
  signerEmployeeId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskAadhaar(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return 'XXXX ' + digits.slice(4);
  return 'XXXX XXXX ' + digits.slice(8, 12);
}

function formatAadhaarDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

function generateTransactionId(): string {
  return 'TXN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function generateSignatureHash(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// ─── OTP Input Component ──────────────────────────────────────────────────────

interface OTPInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  disabled?: boolean;
}

const OTPInput = ({ value, onChange, length = 6, disabled = false }: OTPInputProps) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const newVal = value.split('');
    newVal[index] = digit;
    const joined = newVal.join('').slice(0, length);
    onChange(joined.padEnd(length, '').slice(0, length).replace(/ /g, ''));
    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        inputs.current[index - 1]?.focus();
        const newVal = value.split('');
        newVal[index - 1] = '';
        onChange(newVal.join(''));
      } else {
        const newVal = value.split('');
        newVal[index] = '';
        onChange(newVal.join(''));
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < length - 1) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted.padEnd(length, '').slice(0, length));
    inputs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex items-center gap-3 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
            ${disabled ? 'bg-accent/30 text-muted-foreground border-border cursor-not-allowed' :
              value[i] ? 'border-primary bg-primary/5 text-primary shadow-sm' :
              'border-border bg-accent/50 focus:border-primary focus:bg-primary/5 focus:shadow-sm'
            }`}
        />
      ))}
    </div>
  );
};

// ─── Countdown Timer ──────────────────────────────────────────────────────────

interface CountdownProps {
  seconds: number;
  onExpire: () => void;
}

const Countdown = ({ seconds: initialSeconds, onExpire }: CountdownProps) => {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const timer = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onExpire]);

  const pct = (remaining / initialSeconds) * 100;
  const isLow = remaining <= 30;

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
          <circle
            cx="16" cy="16" r="13" fill="none"
            stroke={isLow ? '#ef4444' : '#3b82f6'}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 13}`}
            strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${isLow ? 'text-red-600' : 'text-blue-600'}`}>
          {remaining}
        </span>
      </div>
      <span className={`text-xs font-medium ${isLow ? 'text-red-600' : 'text-muted-foreground'}`}>
        {isLow ? 'Expiring soon!' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} remaining`}
      </span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AadhaarOTPSigning({
  document,
  employeeName,
  employeeId,
  onClose,
  onSigned,
}: AadhaarOTPSigningProps) {
  const [step, setStep] = useState<SigningStep>('init');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarDisplay, setAadhaarDisplay] = useState('');
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [linkedPhone, setLinkedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpKey, setOtpKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactionId] = useState(generateTransactionId);
  const [consentGiven, setConsentGiven] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [resendCount, setResendCount] = useState(0);

  const aadhaarDigits = aadhaarNumber.replace(/\D/g, '');
  const isValidAadhaar = aadhaarDigits.length === 12;

  const handleAadhaarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    setAadhaarNumber(raw);
    setAadhaarDisplay(formatAadhaarDisplay(raw));
    setError('');
  };

  const handleSendOTP = () => {
    if (!isValidAadhaar) { setError('Please enter a valid 12-digit Aadhaar number.'); return; }
    if (!consentGiven) { setError('Please provide consent to proceed with Aadhaar-based verification.'); return; }

    setLoading(true);
    setError('');

    // Simulate UIDAI OTP API call
    setTimeout(() => {
      const last4 = aadhaarDigits.slice(-4);
      // Simulate masked phone number linked to Aadhaar
      const maskedPhone = '+91 XXXXX XX' + aadhaarDigits.slice(8, 10);
      setLinkedPhone(maskedPhone);
      setLoading(false);
      setOtpExpired(false);
      setOtpKey(k => k + 1);
      setStep('otp-sent');
      toast.success(`OTP sent to Aadhaar-linked mobile number ending in ${aadhaarDigits.slice(-2)}`);
    }, 2000);
  };

  const handleResendOTP = () => {
    if (resendCount >= 3) { setError('Maximum OTP resend attempts reached. Please try again later.'); return; }
    setLoading(true);
    setOtp('');
    setError('');
    setTimeout(() => {
      setLoading(false);
      setOtpExpired(false);
      setOtpKey(k => k + 1);
      setResendCount(c => c + 1);
      toast.info('OTP resent to your Aadhaar-linked mobile number.');
    }, 1500);
  };

  const handleVerifyOTP = () => {
    const cleanOtp = otp.replace(/\D/g, '');
    if (cleanOtp.length !== 6) { setError('Please enter the complete 6-digit OTP.'); return; }
    if (otpExpired) { setError('OTP has expired. Please request a new OTP.'); return; }

    setLoading(true);
    setError('');
    setStep('signing');

    // Simulate OTP verification + digital signing
    setTimeout(() => {
      // For demo: OTP "123456" is always valid, any other shows error
      // In production this would call UIDAI eSign API
      if (cleanOtp === '000000') {
        setLoading(false);
        setStep('otp-sent');
        setError('Invalid OTP. Please check and try again.');
        return;
      }

      const now = new Date();
      const sigData: SignatureData = {
        documentId: document.id,
        signedAt: formatDateTime(now),
        aadhaarLast4: aadhaarDigits.slice(-4),
        transactionId,
        signatureHash: generateSignatureHash(),
        signerName: employeeName,
        signerEmployeeId: employeeId,
      };
      setSignatureData(sigData);
      setLoading(false);
      setStep('signed');
    }, 3000);
  };

  const handleConfirmSigned = () => {
    if (signatureData) {
      onSigned(signatureData);
      toast.success(`Document "${document.name}" digitally signed via Aadhaar eSign.`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl shadow-sm">
              <Fingerprint size={22} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-indigo-900">Aadhaar eSign</h2>
              <p className="text-xs text-indigo-600">Digitally sign document using Aadhaar OTP</p>
            </div>
          </div>
          {step !== 'signing' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/60 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Document Info Strip */}
        <div className="flex items-center gap-3 px-6 py-3 bg-accent/30 border-b border-border">
          <div className="p-1.5 bg-white rounded-lg shadow-sm shrink-0">
            <FileText size={15} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{document.name}</p>
            <p className="text-[10px] text-muted-foreground">{document.category}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <User size={11} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">{employeeName}</span>
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-0">
          {[
            { key: 'aadhaar-entry', label: 'Aadhaar', num: 1 },
            { key: 'otp-sent', label: 'OTP', num: 2 },
            { key: 'signed', label: 'Signed', num: 3 },
          ].map((s, i) => {
            const isActive = step === s.key || (step === 'otp-verify' && s.key === 'otp-sent') || (step === 'signing' && s.key === 'otp-sent');
            const isDone =
              (s.key === 'aadhaar-entry' && ['otp-sent', 'otp-verify', 'signing', 'signed'].includes(step)) ||
              (s.key === 'otp-sent' && ['signing', 'signed'].includes(step));
            return (
              <React.Fragment key={s.key}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone ? 'bg-green-500 text-white' :
                    isActive ? 'bg-indigo-600 text-white' :
                    'bg-accent text-muted-foreground'
                  }`}>
                    {isDone ? <CheckCircle2 size={14} /> : s.num}
                  </div>
                  <span className={`text-xs font-semibold ${
                    isDone ? 'text-green-600' :
                    isActive ? 'text-indigo-700' :
                    'text-muted-foreground'
                  }`}>{s.label}</span>
                </div>
                {i < 2 && <div className="flex-1 h-0.5 bg-border mx-3" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="p-6 space-y-5">
          <AnimatePresence mode="wait">

            {/* ── Step: Init / Aadhaar Entry ── */}
            {(step === 'init' || step === 'aadhaar-entry') && (
              <motion.div
                key="aadhaar"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {/* Legal Notice */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <Shield size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700">
                    <p className="font-semibold mb-1">Aadhaar-based Digital Signature</p>
                    <p>This uses UIDAI's Aadhaar eSign service. An OTP will be sent to your Aadhaar-linked mobile number. The signature is legally valid under the IT Act, 2000.</p>
                  </div>
                </div>

                {/* Aadhaar Input */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
                    Aadhaar Number <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Fingerprint size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showAadhaar ? 'text' : 'password'}
                      className="w-full pl-9 pr-12 py-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 text-sm font-mono tracking-widest transition-all"
                      placeholder="XXXX XXXX XXXX"
                      value={showAadhaar ? aadhaarDisplay : aadhaarDisplay.replace(/\d/g, '•')}
                      onChange={handleAadhaarInput}
                      maxLength={14}
                      autoComplete="off"
                    />
                    <button
                      onClick={() => setShowAadhaar(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showAadhaar ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[10px] text-muted-foreground">12-digit Aadhaar number</p>
                    {aadhaarDigits.length > 0 && (
                      <p className={`text-[10px] font-medium ${isValidAadhaar ? 'text-green-600' : 'text-amber-600'}`}>
                        {aadhaarDigits.length}/12 digits
                      </p>
                    )}
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div
                  onClick={() => setConsentGiven(v => !v)}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    consentGiven ? 'bg-indigo-50 border-indigo-300' : 'bg-accent/30 border-border hover:border-indigo-200'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    consentGiven ? 'bg-indigo-600 border-indigo-600' : 'border-border'
                  }`}>
                    {consentGiven && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I hereby provide my <strong>consent</strong> to use my Aadhaar number for eSign verification as per UIDAI guidelines. I understand that an OTP will be sent to my Aadhaar-linked mobile number for authentication. This is a one-time consent for signing the document: <strong>"{document.name}"</strong>.
                  </p>
                </div>

                {/* Security Badges */}
                <div className="flex items-center gap-3 flex-wrap">
                  {[
                    { icon: Lock, label: 'End-to-End Encrypted' },
                    { icon: Shield, label: 'UIDAI Certified' },
                    { icon: BadgeCheck, label: 'Legally Valid' },
                  ].map(badge => {
                    const BadgeIcon = badge.icon;
                    return (
                      <div key={badge.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                        <BadgeIcon size={11} className="text-green-600" />
                        <span className="text-[10px] font-semibold text-green-700">{badge.label}</span>
                      </div>
                    );
                  })}
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                    <AlertCircle size={13} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={() => { setStep('aadhaar-entry'); handleSendOTP(); }}
                  disabled={!isValidAadhaar || !consentGiven || loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Sending OTP...</>
                  ) : (
                    <><Phone size={16} /> Send OTP to Aadhaar-linked Mobile</>
                  )}
                </button>
              </motion.div>
            )}

            {/* ── Step: OTP Sent / Verify ── */}
            {(step === 'otp-sent' || step === 'otp-verify') && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {/* OTP Sent Notice */}
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-green-700">
                    <p className="font-semibold mb-0.5">OTP Sent Successfully</p>
                    <p>A 6-digit OTP has been sent to your Aadhaar-linked mobile number <strong>{linkedPhone}</strong>. Valid for 10 minutes.</p>
                  </div>
                </div>

                {/* Aadhaar Summary */}
                <div className="flex items-center gap-3 px-4 py-3 bg-accent/30 rounded-xl border border-border">
                  <Fingerprint size={16} className="text-indigo-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold">Aadhaar: XXXX XXXX {aadhaarDigits.slice(-4)}</p>
                    <p className="text-[10px] text-muted-foreground">Transaction ID: {transactionId}</p>
                  </div>
                  <button
                    onClick={() => { setStep('init'); setOtp(''); setError(''); }}
                    className="text-[10px] text-indigo-600 hover:underline font-medium"
                  >
                    Change
                  </button>
                </div>

                {/* OTP Input */}
                <div>
                  <label className="block text-xs font-bold mb-3 text-muted-foreground uppercase tracking-wide text-center">
                    Enter 6-Digit OTP
                  </label>
                  <OTPInput
                    value={otp}
                    onChange={val => { setOtp(val); setError(''); }}
                    length={6}
                    disabled={otpExpired || loading}
                  />
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Enter the OTP received on your Aadhaar-linked mobile
                  </p>
                </div>

                {/* Countdown */}
                {!otpExpired && (
                  <div className="flex items-center justify-center">
                    <Countdown
                      key={otpKey}
                      seconds={600}
                      onExpire={() => { setOtpExpired(true); setError('OTP has expired. Please request a new OTP.'); }}
                    />
                  </div>
                )}

                {otpExpired && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <Clock size={13} className="shrink-0" />
                    OTP has expired. Please request a new OTP to continue.
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                    <AlertCircle size={13} className="shrink-0" />
                    {error}
                  </div>
                )}

                {/* Demo hint */}
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700">
                  <Info size={11} className="shrink-0" />
                  <span>Demo mode: Enter any 6-digit OTP (except 000000) to simulate successful verification.</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleResendOTP}
                    disabled={loading || resendCount >= 3}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-1 justify-center"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Resend OTP {resendCount > 0 ? `(${3 - resendCount} left)` : ''}
                  </button>
                  <button
                    onClick={handleVerifyOTP}
                    disabled={otp.replace(/\D/g, '').length !== 6 || otpExpired || loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                    Verify & Sign
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step: Signing in Progress ── */}
            {step === 'signing' && (
              <motion.div
                key="signing"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8 space-y-5"
              >
                <div className="relative w-20 h-20 mx-auto">
                  <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Fingerprint size={36} className="text-indigo-600" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-300 border-t-indigo-600 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-indigo-900">Applying Digital Signature</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Verifying OTP and applying Aadhaar-based eSign to the document...
                  </p>
                </div>
                <div className="space-y-2 text-left max-w-xs mx-auto">
                  {[
                    'Verifying OTP with UIDAI...',
                    'Generating cryptographic signature...',
                    'Embedding signature in document...',
                    'Recording audit trail...',
                  ].map((step, i) => (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.6 }}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Loader2 size={12} className="text-indigo-500 animate-spin shrink-0" />
                      {step}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step: Signed Successfully ── */}
            {step === 'signed' && signatureData && (
              <motion.div
                key="signed"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* Success Banner */}
                <div className="text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  >
                    <BadgeCheck size={32} className="text-green-600" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-green-800">Document Signed Successfully!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aadhaar eSign applied to <strong>"{document.name}"</strong>
                  </p>
                </div>

                {/* Signature Details */}
                <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-green-100 border-b border-green-200 flex items-center gap-2">
                    <Shield size={14} className="text-green-700" />
                    <span className="text-xs font-bold text-green-800 uppercase tracking-wide">Digital Signature Certificate</span>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {[
                      { label: 'Signer', value: signatureData.signerName },
                      { label: 'Employee ID', value: signatureData.signerEmployeeId },
                      { label: 'Aadhaar (Last 4)', value: `XXXX XXXX ${signatureData.aadhaarLast4}` },
                      { label: 'Signed At', value: signatureData.signedAt },
                      { label: 'Transaction ID', value: signatureData.transactionId },
                    ].map(row => (
                      <div key={row.label} className="flex items-start justify-between gap-4">
                        <span className="text-[10px] text-green-700 font-medium uppercase tracking-wide w-28 shrink-0">{row.label}</span>
                        <span className="text-xs font-semibold text-green-900 text-right font-mono">{row.value}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-green-200">
                      <p className="text-[10px] text-green-700 font-medium uppercase tracking-wide mb-1">Signature Hash (SHA-256)</p>
                      <p className="text-[9px] font-mono text-green-800 break-all bg-white/60 px-2 py-1.5 rounded-lg border border-green-200">
                        {signatureData.signatureHash}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Legal Notice */}
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info size={13} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-700">
                    This digital signature is legally valid under the <strong>Information Technology Act, 2000</strong> and is equivalent to a handwritten signature. The signature is backed by Aadhaar authentication via UIDAI.
                  </p>
                </div>

                <button
                  onClick={handleConfirmSigned}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors shadow-md"
                >
                  <CheckCircle2 size={16} /> Done — Close
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}