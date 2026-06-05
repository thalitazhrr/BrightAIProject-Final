import React, { useRef, useEffect, useState } from 'react';
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
    detailedDescription:
      'Kategori Sales menyajikan analisis menyeluruh terhadap aktivitas penjualan layanan HSI (High Speed Internet). ' +
      'Cakupan analisis meliputi jumlah total order HSI Bisnis dan HSI Basic, distribusi order berdasarkan wilayah regional dan witel, ' +
      'serta segmentasi berdasarkan kategori bandwidth. Selain itu, kategori ini juga mencakup analisis tingkat penetrasi HSI di setiap wilayah, ' +
      'evaluasi efektivitas saluran penjualan, tren pertumbuhan order secara bulanan maupun tahunan, ' +
      'tingkat keberhasilan proses fulfillment, serta rata-rata waktu instalasi layanan per wilayah.',
  },
  {
    id: 'dapros',
    label: 'Data Proses',
    icon: Database,
    description: 'Profil & segmentasi pelanggan',
    color: 'purple',
    detailedDescription:
      'Kategori Data Proses menampilkan profil dan karakteristik pelanggan HSI secara mendalam. ' +
      'Analisis mencakup segmentasi pelanggan berdasarkan kecepatan layanan dan kontribusi pendapatan, ' +
      'distribusi geografis pelanggan di seluruh wilayah Indonesia, serta analisis loyalitas dan masa berlangganan pelanggan. ' +
      'Kategori ini juga menyajikan profil pendapatan pelanggan per segmen, distribusi kecepatan layanan yang digunakan, ' +
      'tingkat penetrasi produk digital yang dibundel dengan HSI, serta pola kombinasi layanan yang dipilih oleh pelanggan.',
  },
  {
    id: 'target',
    label: 'Target',
    icon: Target,
    description: 'Pencapaian target & realisasi',
    color: 'green',
    detailedDescription:
      'Kategori Target menyajikan perbandingan antara target yang ditetapkan dengan realisasi pencapaian layanan HSI. ' +
      'Analisis meliputi tingkat pencapaian target realisasi HSI per wilayah regional, tren pertumbuhan realisasi terhadap target secara bulanan, ' +
      'serta evaluasi kinerja setiap regional berdasarkan persentase pencapaian. ' +
      'Kategori ini juga mencakup segmentasi performa HSI Bisnis dan HSI Basic dibandingkan dengan target masing-masing, ' +
      'serta analisis posisi kompetitif HSI terhadap target pangsa pasar yang telah ditetapkan.',
  },
  {
    id: 'revenue',
    label: 'Revenue',
    icon: DollarSign,
    description: 'Pendapatan & tren revenue',
    color: 'amber',
    detailedDescription:
      'Kategori Revenue menyajikan analisis pendapatan layanan HSI secara komprehensif. ' +
      'Cakupan analisis meliputi tren revenue HSI bulanan beserta pertumbuhannya, kontribusi revenue per wilayah regional, ' +
      'serta analisis siklus hidup pelanggan terhadap pendapatan yang dihasilkan. ' +
      'Selain itu, kategori ini juga mencakup klasifikasi revenue berdasarkan akun GL, analisis revenue lintas wilayah geografis, ' +
      'strategi peningkatan skala revenue HSI, serta pola perilaku pelanggan yang memengaruhi besaran pendapatan.',
  },
  {
    id: 'churn',
    label: 'Churn',
    icon: AlertTriangle,
    description: 'Retensi & pola churn pelanggan',
    color: 'red',
    detailedDescription:
      'Kategori Churn menyajikan analisis kehilangan pelanggan atau penonaktifan layanan (CT0) pada layanan HSI. ' +
      'Analisis mencakup tingkat churn pelanggan internet per wilayah regional, perbandingan churn rate antar divisi layanan HSI, ' +
      'serta pola churn berdasarkan kategori bandwidth dan lama masa berlangganan. ' +
      'Kategori ini juga menampilkan evaluasi kinerja churn per witel, identifikasi periode risiko churn tertinggi, ' +
      'serta pola CT0 pelanggan berdasarkan siklus masa layanan bulanan dan kuartalan.',
  },
];

// ─── Geographic scope options ──────────────────────────────────────────────────
export const GEO_OPTIONS = {
  regional: [
    { label: 'Regional 1', dbValue: 'REGIONAL 1', tregValue: 'TREG 1' },
    { label: 'Regional 2', dbValue: 'REGIONAL 2', tregValue: 'TREG 2' },
    { label: 'Regional 3', dbValue: 'REGIONAL 3', tregValue: 'TREG 3' },
    { label: 'Regional 4', dbValue: 'REGIONAL 4', tregValue: 'TREG 4' },
    { label: 'Regional 5', dbValue: 'REGIONAL 5', tregValue: 'TREG 5' },
  ],
  witel: [
    { label: 'Aceh',               dbValue: 'ACEH',                  regional: 'REGIONAL 1' },
    { label: 'Sumut',              dbValue: 'SUMUT',                 regional: 'REGIONAL 1' },
    { label: 'Sumbar Jambi',       dbValue: 'SUMBAR JAMBI',          regional: 'REGIONAL 1' },
    { label: 'Riau',               dbValue: 'RIAU',                  regional: 'REGIONAL 1' },
    { label: 'Sumbagsel',          dbValue: 'SUMBAGSEL',             regional: 'REGIONAL 1' },
    { label: 'Lampung Bengkulu',   dbValue: 'LAMPUNG BENGKULU',      regional: 'REGIONAL 1' },
    { label: 'Banten',             dbValue: 'BANTEN',                regional: 'REGIONAL 2' },
    { label: 'Bekasi Karawang',    dbValue: 'BEKASI KARAWANG',       regional: 'REGIONAL 2' },
    { label: 'Bandung',            dbValue: 'BANDUNG',               regional: 'REGIONAL 2' },
    { label: 'Jakarta Centrum',    dbValue: 'JAKARTA CENTRUM',       regional: 'REGIONAL 2' },
    { label: 'Jakarta Inner',      dbValue: 'JAKARTA INNER',         regional: 'REGIONAL 2' },
    { label: 'Jakarta Outer',      dbValue: 'JAKARTA OUTER',         regional: 'REGIONAL 2' },
    { label: 'Priangan Barat',     dbValue: 'PRIANGAN BARAT',        regional: 'REGIONAL 2' },
    { label: 'Priangan Timur',     dbValue: 'PRIANGAN TIMUR',        regional: 'REGIONAL 2' },
    { label: 'Bali',               dbValue: 'BALI',                  regional: 'REGIONAL 3' },
    { label: 'Jatim Barat',        dbValue: 'JATIM BARAT',           regional: 'REGIONAL 3' },
    { label: 'Jatim Timur',        dbValue: 'JATIM TIMUR',           regional: 'REGIONAL 3' },
    { label: 'Nusa Tenggara',      dbValue: 'NUSA TENGGARA',         regional: 'REGIONAL 3' },
    { label: 'Semarang Jateng Utara', dbValue: 'SEMARANG JATENG UTARA', regional: 'REGIONAL 3' },
    { label: 'Solo Jateng Timur',  dbValue: 'SOLO JATENG TIMUR',     regional: 'REGIONAL 3' },
    { label: 'Suramadu',           dbValue: 'SURAMADU',              regional: 'REGIONAL 3' },
    { label: 'Yogya Jateng Selatan', dbValue: 'YOGYA JATENG SELATAN', regional: 'REGIONAL 3' },
    { label: 'Balikpapan',         dbValue: 'BALIKPAPAN',            regional: 'REGIONAL 4' },
    { label: 'Kalbar',             dbValue: 'KALBAR',                regional: 'REGIONAL 4' },
    { label: 'Kalselteng',         dbValue: 'KALSELTENG',            regional: 'REGIONAL 4' },
    { label: 'Kaltimtara',         dbValue: 'KALTIMTARA',            regional: 'REGIONAL 4' },
    { label: 'Papua Barat',        dbValue: 'PAPUA BARAT',           regional: 'REGIONAL 5' },
    { label: 'Papua',              dbValue: 'PAPUA',                 regional: 'REGIONAL 5' },
    { label: 'Sulbagsel',          dbValue: 'SULBAGSEL',             regional: 'REGIONAL 5' },
    { label: 'Sulbagteng',         dbValue: 'SULBAGTENG',            regional: 'REGIONAL 5' },
    { label: 'Sumalut',            dbValue: 'SUMALUT',               regional: 'REGIONAL 5' },
  ],
};

// ─── Geo Selector Component ────────────────────────────────────────────────────
const GeoSelector = ({ theme, geoContext, onGeoChange }) => {
  const t = theme === 'dark';
  const scope = geoContext?.scope || 'nasional';

  const scopeBtn = (label, value) => (
    <button
      key={value}
      onClick={() => onGeoChange({ scope: value, dbValue: null, tregValue: null, label: label })}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
        scope === value
          ? t
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-blue-500 border-blue-400 text-white'
          : t
            ? 'bg-slate-700/50 border-slate-600/50 text-slate-400 hover:text-white hover:bg-slate-600/60'
            : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 mb-2.5 px-1`}>
      <span className={`text-xs font-semibold ${t ? 'text-slate-500' : 'text-gray-400'}`}>Cakupan:</span>
      {scopeBtn('Nasional', 'nasional')}
      {scopeBtn('Regional', 'regional')}
      {scopeBtn('Witel', 'witel')}

      {scope === 'regional' && (
        <select
          value={geoContext?.dbValue || ''}
          onChange={e => {
            const opt = GEO_OPTIONS.regional.find(r => r.dbValue === e.target.value);
            if (opt) onGeoChange({ scope: 'regional', dbValue: opt.dbValue, tregValue: opt.tregValue, label: opt.label });
          }}
          className={`text-xs rounded-lg px-2 py-1 border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            t
              ? 'bg-slate-700 border-slate-600 text-white'
              : 'bg-white border-gray-200 text-gray-800'
          }`}
        >
          <option value="">Pilih Regional…</option>
          {GEO_OPTIONS.regional.map(r => (
            <option key={r.dbValue} value={r.dbValue}>{r.label}</option>
          ))}
        </select>
      )}

      {scope === 'witel' && (
        <select
          value={geoContext?.dbValue || ''}
          onChange={e => {
            const opt = GEO_OPTIONS.witel.find(w => w.dbValue === e.target.value);
            if (opt) onGeoChange({ scope: 'witel', dbValue: opt.dbValue, label: opt.label });
          }}
          className={`text-xs rounded-lg px-2 py-1 border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            t
              ? 'bg-slate-700 border-slate-600 text-white'
              : 'bg-white border-gray-200 text-gray-800'
          }`}
        >
          <option value="">Pilih Witel…</option>
          {['REGIONAL 1','REGIONAL 2','REGIONAL 3','REGIONAL 4','REGIONAL 5'].map(reg => (
            <optgroup key={reg} label={reg.replace('REGIONAL', 'Regional')}>
              {GEO_OPTIONS.witel.filter(w => w.regional === reg).map(w => (
                <option key={w.dbValue} value={w.dbValue}>{w.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      {scope !== 'nasional' && geoContext?.label && geoContext?.dbValue && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          t ? 'bg-blue-600/20 text-blue-300' : 'bg-blue-50 text-blue-600'
        }`}>
          {geoContext.label}
        </span>
      )}
    </div>
  );
};

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
  const [hoveredCat, setHoveredCat] = useState(null);
  const hovered = CATEGORIES.find(c => c.id === hoveredCat);

  return (
    <Panel theme={theme}>
      <div className="flex items-center justify-between mb-3">
        <PanelLabel theme={theme}>Pilih Kategori Analisis</PanelLabel>
        <BackBtn theme={theme} onClick={onBack}>Kembali</BackBtn>
      </div>

      {/* Category buttons */}
      <div className="grid grid-cols-5 gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const c = COLOR[cat.color][t ? 'dark' : 'light'];
          const isHovered = hoveredCat === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              onMouseEnter={() => setHoveredCat(cat.id)}
              onMouseLeave={() => setHoveredCat(null)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                c.bg
              } ${isHovered ? c.border.replace('/30', '/70') : c.border} ${c.hover} ${
                isHovered ? 'scale-105 shadow-md' : ''
              }`}
            >
              <Icon className={`w-5 h-5 ${c.icon}`} />
              <span className={`text-xs font-semibold leading-tight ${c.text}`}>
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Description panel — shown on hover, hint text when none hovered */}
      <div className={`mt-3 min-h-[3.5rem] rounded-xl px-3 py-2.5 transition-all duration-200 border ${
        hovered
          ? t
            ? `${COLOR[hovered.color].dark.bg} ${COLOR[hovered.color].dark.border}`
            : `${COLOR[hovered.color].light.bg} ${COLOR[hovered.color].light.border}`
          : t
            ? 'bg-transparent border-slate-700/30'
            : 'bg-transparent border-gray-100'
      }`}>
        {hovered ? (
          <div>
            <p className={`text-xs font-semibold mb-1 ${
              t ? COLOR[hovered.color].dark.text : COLOR[hovered.color].light.text
            }`}>
              {hovered.label}
            </p>
            <p className={`text-xs leading-relaxed ${t ? 'text-slate-300' : 'text-gray-700'}`}>
              {hovered.detailedDescription}
            </p>
          </div>
        ) : (
          <p className={`text-xs italic ${t ? 'text-slate-600' : 'text-gray-400'}`}>
            Arahkan kursor ke kategori untuk melihat deskripsi lengkapnya.
          </p>
        )}
      </div>
    </Panel>
  );
};

// ─── Step: Question List + Editable Input ─────────────────────────────────────
const QuestionSelect = ({ theme, category, inputValue, onInputChange, onSend, onBack, geoContext, onGeoChange }) => {
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

      {/* Geographic scope selector */}
      <GeoSelector theme={theme} geoContext={geoContext} onGeoChange={onGeoChange} />

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
  onSendToChat,
  geoContext,
  onGeoChange,
}) => {
  switch (guidedStep) {
    case 'mode_select':
      return <ModeSelect theme={theme} onSelect={onModeSelect} />;

    case 'forecast_select':
      return (
        <ForecastPanel
          theme={theme}
          onBack={() => onBack('mode_select')}
          onSendToChat={onSendToChat}
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
          geoContext={geoContext}
          onGeoChange={onGeoChange}
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
