import React, { useRef, useEffect } from 'react';
import {
  BarChart2, Clock, ChevronLeft, TrendingUp, Database,
  Target, DollarSign, AlertTriangle, RefreshCw, Send
} from 'lucide-react';
import ForecastPanel from './ForecastPanel';

// ─── Predefined questions per category ────────────────────────────────────────
export const GUIDED_QUESTIONS = {
  sales: [
    'Berapa total order HSI bisnis dan basic bulan ini?',
    'Bagaimana distribusi order HSI per regional dan witel?',
    'Analisis order HSI berdasarkan kategori bandwidth',
    'Tingkat penetrasi HSI di wilayah mana paling tinggi?',
    'Performa channel penjualan HSI yang paling efektif',
    'Tren pertumbuhan order HSI bulanan dan tahunan',
    'Bagaimana tingkat keberhasilan fulfillment order HSI?',
    'Analisis waktu instalasi HSI per wilayah',
  ],
  dapros: [
    'Segmentasi pelanggan HSI berdasarkan speed dan revenue',
    'Distribusi geografis pelanggan HSI per wilayah',
    'Analisis loyalitas pelanggan HSI dan tenure layanan',
    'Profil revenue pelanggan HSI per segmen',
    'Distribusi kecepatan layanan HSI per customer',
    'Penetrasi produk digital bundling HSI',
    'Analisis bundle layanan HSI dan produk tambahan',
  ],
  target: [
    'Berapa achievement rate target realisasi HSI per regional?',
    'Tren pertumbuhan HSI target vs realisasi bulanan',
    'Performa HSI regional berdasarkan target pencapaian',
    'Performa segmentasi HSI bisnis dan basic vs target',
    'Performa kompetitif HSI vs target market share',
  ],
  revenue: [
    'Tren revenue HSI bulanan dan pertumbuhannya',
    'Performa revenue HSI per regional kontribusi terbesar',
    'Analisis customer lifecycle revenue HSI',
    'Klasifikasi revenue HSI per GL account',
    'Analisis revenue cross geographic regional witel',
    'Strategi scaling revenue HSI growth dan portfolio',
    'Pola perilaku pelanggan HSI terhadap revenue',
  ],
  churn: [
    'Analisis tingkat churn pelanggan internet per regional',
    'Perbandingan churn rate antar divisi HSI',
    'Pola churn berdasarkan bandwidth dan masa layanan',
    'Performa churn per witel dan timeline risiko',
    'Pola CT0 pelanggan berdasarkan masa layanan HSI',
    'Analisis churn pattern monthly dan quarterly HSI',
  ],
};

// ─── Category config ───────────────────────────────────────────────────────────
export const CATEGORIES = [
  {
    id: 'sales',
    label: 'Sales',
    icon: TrendingUp,
    description: 'Order, penetrasi & channel penjualan',
    color: 'blue',
  },
  {
    id: 'dapros',
    label: 'Data Proses',
    icon: Database,
    description: 'Profil & segmentasi pelanggan',
    color: 'purple',
  },
  {
    id: 'target',
    label: 'Target',
    icon: Target,
    description: 'Pencapaian target & realisasi',
    color: 'green',
  },
  {
    id: 'revenue',
    label: 'Revenue',
    icon: DollarSign,
    description: 'Pendapatan & tren revenue',
    color: 'amber',
  },
  {
    id: 'churn',
    label: 'Churn',
    icon: AlertTriangle,
    description: 'Retensi & pola churn pelanggan',
    color: 'red',
  },
];

// ─── Color map ─────────────────────────────────────────────────────────────────
const COLOR = {
  blue: {
    dark:  { bg: 'bg-blue-600/15',   border: 'border-blue-500/30',  text: 'text-blue-400',   hover: 'hover:bg-blue-600/25 hover:border-blue-400/50',   icon: 'text-blue-400' },
    light: { bg: 'bg-blue-50',       border: 'border-blue-200',     text: 'text-blue-700',   hover: 'hover:bg-blue-100 hover:border-blue-300',          icon: 'text-blue-600' },
  },
  purple: {
    dark:  { bg: 'bg-purple-600/15', border: 'border-purple-500/30',text: 'text-purple-400', hover: 'hover:bg-purple-600/25 hover:border-purple-400/50',icon: 'text-purple-400' },
    light: { bg: 'bg-purple-50',     border: 'border-purple-200',   text: 'text-purple-700', hover: 'hover:bg-purple-100 hover:border-purple-300',       icon: 'text-purple-600' },
  },
  green: {
    dark:  { bg: 'bg-green-600/15',  border: 'border-green-500/30', text: 'text-green-400',  hover: 'hover:bg-green-600/25 hover:border-green-400/50',  icon: 'text-green-400' },
    light: { bg: 'bg-green-50',      border: 'border-green-200',    text: 'text-green-700',  hover: 'hover:bg-green-100 hover:border-green-300',         icon: 'text-green-600' },
  },
  amber: {
    dark:  { bg: 'bg-amber-600/15',  border: 'border-amber-500/30', text: 'text-amber-400',  hover: 'hover:bg-amber-600/25 hover:border-amber-400/50',  icon: 'text-amber-400' },
    light: { bg: 'bg-amber-50',      border: 'border-amber-200',    text: 'text-amber-700',  hover: 'hover:bg-amber-100 hover:border-amber-300',         icon: 'text-amber-600' },
  },
  red: {
    dark:  { bg: 'bg-red-600/15',    border: 'border-red-500/30',   text: 'text-red-400',    hover: 'hover:bg-red-600/25 hover:border-red-400/50',      icon: 'text-red-400' },
    light: { bg: 'bg-red-50',        border: 'border-red-200',      text: 'text-red-700',    hover: 'hover:bg-red-100 hover:border-red-300',             icon: 'text-red-600' },
  },
};

// ─── Shared wrapper ────────────────────────────────────────────────────────────
const Panel = ({ theme, children }) => (
  <div className={`px-4 pb-4 pt-3 border-t ${
    theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/70'
  }`}>
    {children}
  </div>
);

const PanelLabel = ({ theme, children }) => (
  <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
    theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
  }`}>
    {children}
  </p>
);

const BackBtn = ({ theme, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ${
      theme === 'dark'
        ? 'text-slate-400 hover:text-white hover:bg-slate-700/60'
        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    <ChevronLeft className="w-3 h-3" />
    {children}
  </button>
);

// ─── Step: Mode Selection ──────────────────────────────────────────────────────
const ModeSelect = ({ theme, onSelect }) => {
  const t = theme === 'dark';
  return (
    <Panel theme={theme}>
      <PanelLabel theme={theme}>Pilih Jenis Analisis</PanelLabel>
      <div className="grid grid-cols-2 gap-3">
        {/* Analisis Saat Ini */}
        <button
          onClick={() => onSelect('current')}
          className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
            t
              ? 'bg-blue-600/10 border-blue-500/30 hover:bg-blue-600/20 hover:border-blue-400/60'
              : 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
          }`}
        >
          <BarChart2 className={`w-6 h-6 ${t ? 'text-blue-400' : 'text-blue-600'}`} />
          <div>
            <p className={`font-semibold text-sm ${t ? 'text-white' : 'text-gray-900'}`}>
              Analisis Saat Ini
            </p>
            <p className={`text-xs mt-0.5 leading-relaxed ${t ? 'text-slate-400' : 'text-gray-500'}`}>
              Lihat kondisi & performa HSI terkini
            </p>
          </div>
        </button>

        {/* Prediksi 1 Bulan */}
        <button
          onClick={() => onSelect('forecast')}
          className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
            t
              ? 'bg-purple-600/10 border-purple-500/30 hover:bg-purple-600/20 hover:border-purple-400/60'
              : 'bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300'
          }`}
        >
          <TrendingUp className={`w-6 h-6 ${t ? 'text-purple-400' : 'text-purple-600'}`} />
          <div>
            <p className={`font-semibold text-sm ${t ? 'text-white' : 'text-gray-900'}`}>
              Prediksi 1 Bulan Kedepan
            </p>
            <p className={`text-xs mt-0.5 leading-relaxed ${t ? 'text-slate-400' : 'text-gray-500'}`}>
              Forecasting berbasis time series
            </p>
          </div>
        </button>
      </div>
    </Panel>
  );
};

// ─── Step: Category Selection ──────────────────────────────────────────────────
const CategorySelect = ({ theme, onSelect, onBack }) => {
  const t = theme === 'dark';
  return (
    <Panel theme={theme}>
      <div className="flex items-center justify-between mb-3">
        <PanelLabel theme={theme}>Pilih Kategori Analisis</PanelLabel>
        <BackBtn theme={theme} onClick={onBack}>Kembali</BackBtn>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const c = COLOR[cat.color][t ? 'dark' : 'light'];
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              title={cat.description}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                c.bg
              } ${c.border} ${c.hover}`}
            >
              <Icon className={`w-5 h-5 ${c.icon}`} />
              <span className={`text-xs font-semibold leading-tight ${c.text}`}>
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className={`text-xs mt-2 ${t ? 'text-slate-500' : 'text-gray-400'}`}>
        Arahkan kursor ke kategori untuk melihat deskripsi
      </p>
    </Panel>
  );
};

// ─── Step: Question List + Editable Input ─────────────────────────────────────
const QuestionSelect = ({ theme, category, inputValue, onInputChange, onSend, onBack }) => {
  const t = theme === 'dark';
  const cat = CATEGORIES.find(c => c.id === category);
  const questions = GUIDED_QUESTIONS[category] || [];
  const c = cat ? COLOR[cat.color][t ? 'dark' : 'light'] : {};
  const textareaRef = useRef(null);

  // Focus textarea when a question is selected
  useEffect(() => {
    if (inputValue && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [inputValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) onSend();
    }
  };

  return (
    <Panel theme={theme}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {cat && <cat.icon className={`w-4 h-4 ${c.icon}`} />}
          <PanelLabel theme={theme}>{cat?.label} — Pilih atau Ketik Pertanyaan</PanelLabel>
        </div>
        <BackBtn theme={theme} onClick={onBack}>Ganti Kategori</BackBtn>
      </div>

      {/* Question suggestion chips */}
      <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1 mb-3">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onInputChange(q)}
            className={`text-left px-3.5 py-2 rounded-xl border text-sm transition-all duration-150 ${
              inputValue === q
                ? t
                  ? `${c.bg} ${c.border} ${c.text}`
                  : `${c.bg} ${c.border} ${c.text}`
                : t
                  ? 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:border-slate-500 hover:text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900'
            } shadow-sm`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Editable input + send */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pilih pertanyaan di atas atau ketik sendiri..."
          rows={2}
          className={`flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
            t
              ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          }`}
        />
        <button
          onClick={onSend}
          disabled={!inputValue.trim()}
          className={`shrink-0 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
            inputValue.trim()
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              : t
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Kirim</span>
        </button>
      </div>
    </Panel>
  );
};

// ─── Step: Awaiting AI response ────────────────────────────────────────────────
const AwaitingAnswer = ({ theme }) => {
  const t = theme === 'dark';
  return (
    <Panel theme={theme}>
      <div className={`flex items-center gap-2.5 text-sm ${t ? 'text-slate-400' : 'text-gray-500'}`}>
        <div className="flex gap-1">
          {[0, 0.15, 0.3].map((delay, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full animate-bounce ${t ? 'bg-blue-400' : 'bg-blue-500'}`}
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>
        <span>BrightAI sedang menganalisis data...</span>
      </div>
    </Panel>
  );
};

// ─── Step: Post-answer navigation ─────────────────────────────────────────────
const PostAnswer = ({ theme, category, onTanyaLagi, onGantiKategori, onReset }) => {
  const t = theme === 'dark';
  const cat = CATEGORIES.find(c => c.id === category);
  const c = cat ? COLOR[cat.color][t ? 'dark' : 'light'] : {};

  return (
    <Panel theme={theme}>
      <PanelLabel theme={theme}>Selanjutnya</PanelLabel>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onTanyaLagi}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${
            c.bg
          } ${c.border} ${c.text} ${c.hover}`}
        >
          Tanya Lagi di {cat?.label}
        </button>
        <button
          onClick={onGantiKategori}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
            t
              ? 'bg-slate-700/40 border-slate-600/50 text-slate-300 hover:bg-slate-700/70 hover:border-slate-500'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          Ganti Kategori
        </button>
        <button
          onClick={onReset}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
            t
              ? 'bg-slate-700/40 border-slate-600/50 text-slate-300 hover:bg-slate-700/70 hover:border-slate-500'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Mulai Ulang
        </button>
      </div>
    </Panel>
  );
};

// ─── Main GuidedFlow component ─────────────────────────────────────────────────
const GuidedFlow = ({
  theme,
  guidedStep,
  guidedCategory,
  inputValue,
  onModeSelect,
  onCategorySelect,
  onInputChange,
  onSend,
  onBack,
  onGantiKategori,
  onReset,
}) => {
  switch (guidedStep) {
    case 'mode_select':
      return <ModeSelect theme={theme} onSelect={onModeSelect} />;

    case 'forecast_select':
      return (
        <ForecastPanel
          theme={theme}
          onBack={() => onBack('mode_select')}
        />
      );

    case 'category_select':
      return (
        <CategorySelect
          theme={theme}
          onSelect={onCategorySelect}
          onBack={() => onBack('mode_select')}
        />
      );

    case 'question_select':
      return (
        <QuestionSelect
          theme={theme}
          category={guidedCategory}
          inputValue={inputValue}
          onInputChange={onInputChange}
          onSend={onSend}
          onBack={() => onBack('category_select')}
        />
      );

    case 'awaiting':
      return <AwaitingAnswer theme={theme} />;

    case 'post_answer':
      return (
        <PostAnswer
          theme={theme}
          category={guidedCategory}
          onTanyaLagi={() => onBack('question_select')}
          onGantiKategori={onGantiKategori}
          onReset={onReset}
        />
      );

    default:
      return null;
  }
};

export default GuidedFlow;
