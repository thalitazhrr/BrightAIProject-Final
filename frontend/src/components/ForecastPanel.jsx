import React, { useState, useEffect } from 'react';
import { TrendingUp, ChevronLeft, Loader, AlertTriangle, CheckCircle, BarChart2 } from 'lucide-react';
import telkomApi from '../services/telkomApi';

// ─── Constants ─────────────────────────────────────────────────────────────────

const METRICS = [
  { value: 'order_hsi',        label: 'Order HSI',          unit: 'order',     model: 'gru' },
  { value: 'revenue_hsi',      label: 'Revenue HSI',        unit: 'Rp',        model: 'lstm' },
  { value: 'churn_hsi',        label: 'Churn HSI',          unit: 'pelanggan', model: 'gru' },
  { value: 'realisasi_hsi',    label: 'Realisasi HSI',      unit: 'SSL',       model: 'lstm' },
  { value: 'subscriber_hsi',   label: 'Subscriber HSI',     unit: 'pelanggan', model: 'tft' },
  { value: 'fulfillment_rate', label: 'Fulfillment Rate',   unit: '%',         model: 'gru' },
  { value: 'recurring_revenue',label: 'Recurring Revenue',  unit: 'Rp',        model: 'lstm' },
  { value: 'avg_install_days', label: 'Avg Install Days',   unit: 'hari',      model: 'gru' },
];

const REGIONALS = [
  { value: 'NASIONAL', label: 'Nasional (Semua Regional)' },
  { value: 'REG-1',    label: 'Regional 1' },
  { value: 'REG-2',    label: 'Regional 2' },
  { value: 'REG-3',    label: 'Regional 3' },
  { value: 'REG-4',    label: 'Regional 4' },
  { value: 'REG-5',    label: 'Regional 5' },
];

// ─── Helper: format number ──────────────────────────────────────────────────────
function formatValue(value, unit) {
  if (unit === 'Rp') return `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
  if (unit === '%') return `${value}%`;
  return `${new Intl.NumberFormat('id-ID').format(value)} ${unit}`;
}

// ─── ForecastPanel ──────────────────────────────────────────────────────────────
const ForecastPanel = ({ theme, onBack }) => {
  const t = theme === 'dark';

  const [metric, setMetric]     = useState('order_hsi');
  const [regional, setRegional] = useState('NASIONAL');
  const [witel, setWitel]       = useState('');
  const [modelOverride, setModelOverride] = useState(''); // '' = pakai default per metrik

  const [witels, setWitels]         = useState([]);
  const [witelsLoading, setWitelsLoading] = useState(false);

  // Fetch witels whenever metric or regional changes (only if regional bukan NASIONAL)
  useEffect(() => {
    if (regional === 'NASIONAL') {
      setWitels([]);
      setWitel('');
      return;
    }
    setWitelsLoading(true);
    setWitel('');
    telkomApi.getWitels(metric, regional)
      .then(res => setWitels(res.witels || []))
      .catch(() => setWitels([]))
      .finally(() => setWitelsLoading(false));
  }, [metric, regional]);

  const [trainStatus, setTrainStatus] = useState(null); // null | 'loading' | 'done' | 'error'
  const [trainMsg, setTrainMsg]       = useState('');

  const [predictStatus, setPredictStatus] = useState(null); // null | 'loading' | 'done' | 'error'
  const [result, setResult]               = useState(null);
  const [predictError, setPredictError]   = useState('');

  const selectedMetric = METRICS.find(m => m.value === metric);
  const activeModel = modelOverride || selectedMetric.model;

  // ── Train ──
  const handleTrain = async () => {
    setTrainStatus('loading');
    setTrainMsg('');
    try {
      const res = await telkomApi.trainForecastModel({
        model_type: activeModel,
        metric,
        regional,
        witel: witel || null,
        epochs: 100,
      });
      setTrainStatus('done');
      setTrainMsg(res.message || 'Training dimulai di background. Tunggu beberapa menit lalu coba Prediksi.');
    } catch (e) {
      setTrainStatus('error');
      setTrainMsg(e.message || 'Gagal memulai training.');
    }
  };

  // ── Predict ──
  const handlePredict = async () => {
    setPredictStatus('loading');
    setPredictError('');
    setResult(null);
    try {
      const res = await telkomApi.predictForecast({
        model_type: activeModel,
        metric,
        regional,
        witel: witel || null,
      });
      setPredictStatus('done');
      setResult(res.result);
    } catch (e) {
      setPredictStatus('error');
      setPredictError(e.message || 'Gagal mendapatkan prediksi. Pastikan model sudah ditraining.');
    }
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const card = `rounded-xl border p-4 ${t ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-gray-200'}`;
  const label = `text-xs font-semibold uppercase tracking-wider mb-1.5 ${t ? 'text-slate-400' : 'text-gray-500'}`;
  const select = `w-full rounded-lg px-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
    t ? 'bg-slate-900/60 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'
  }`;
  const btnPrimary = 'flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const btnSecondary = `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
    t ? 'bg-slate-700/40 border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
  }`;

  return (
    <div className={`px-4 pb-4 pt-3 border-t ${t ? 'border-slate-700/50' : 'border-gray-200/70'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${t ? 'text-blue-400' : 'text-blue-600'}`} />
          <p className={`text-xs font-semibold uppercase tracking-wider ${t ? 'text-slate-400' : 'text-gray-500'}`}>
            Prediksi 1 Bulan Kedepan
          </p>
        </div>
        <button
          onClick={onBack}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ${
            t ? 'text-slate-400 hover:text-white hover:bg-slate-700/60' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <ChevronLeft className="w-3 h-3" />
          Kembali
        </button>
      </div>

      {/* Form */}
      <div className="space-y-3 mb-4">
        {/* Metric */}
        <div>
          <p className={label}>Metrik</p>
          <select
            value={metric}
            onChange={e => { setMetric(e.target.value); setResult(null); setPredictStatus(null); }}
            className={select}
          >
            {METRICS.map(m => (
              <option key={m.value} value={m.value}>{m.label} ({m.unit})</option>
            ))}
          </select>
          {/* Pilihan model override */}
          <div className="flex gap-1.5 mt-2">
            {['', 'gru', 'lstm'].map(m => (
              <button
                key={m}
                onClick={() => { setModelOverride(m); setResult(null); setPredictStatus(null); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  activeModel === (m || selectedMetric.model) && (m !== '' || modelOverride === '')
                    ? t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-500 border-blue-400 text-white'
                    : t ? 'bg-slate-700/40 border-slate-600 text-slate-400 hover:text-white' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                }`}
              >
                {m === '' ? `Auto (${selectedMetric?.model?.toUpperCase()})` : m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Regional */}
        <div>
          <p className={label}>Regional</p>
          <select
            value={regional}
            onChange={e => { setRegional(e.target.value); setResult(null); setPredictStatus(null); }}
            className={select}
          >
            {REGIONALS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Witel (optional, dropdown dari database) */}
        {regional !== 'NASIONAL' && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <p className={label} style={{marginBottom: 0}}>Witel</p>
              <span className={`text-xs font-normal ${t ? 'text-slate-500' : 'text-gray-400'}`}>(opsional)</span>
              {witelsLoading && <Loader className={`w-3 h-3 animate-spin ${t ? 'text-slate-400' : 'text-gray-400'}`} />}
            </div>
            <select
              value={witel}
              onChange={e => { setWitel(e.target.value); setResult(null); setPredictStatus(null); }}
              className={select}
              disabled={witelsLoading}
            >
              <option value="">— Level Regional (tanpa witel) —</option>
              {witels.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            {!witelsLoading && witels.length === 0 && (
              <p className={`text-xs mt-1 ${t ? 'text-slate-500' : 'text-gray-400'}`}>
                Tidak ada data witel untuk regional ini
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={handleTrain} disabled={trainStatus === 'loading'} className={btnSecondary}>
          {trainStatus === 'loading'
            ? <Loader className="w-4 h-4 animate-spin" />
            : <BarChart2 className="w-4 h-4" />}
          Training Model
        </button>
        <button onClick={handlePredict} disabled={predictStatus === 'loading'} className={btnPrimary}>
          {predictStatus === 'loading'
            ? <Loader className="w-4 h-4 animate-spin" />
            : <TrendingUp className="w-4 h-4" />}
          Prediksi
        </button>
      </div>

      {/* Train status message */}
      {trainStatus && trainStatus !== 'loading' && (
        <div className={`flex items-start gap-2 p-3 rounded-xl text-xs mb-3 ${
          trainStatus === 'done'
            ? t ? 'bg-green-600/10 border border-green-500/30 text-green-400' : 'bg-green-50 border border-green-200 text-green-700'
            : t ? 'bg-red-600/10 border border-red-500/30 text-red-400'   : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {trainStatus === 'done'
            ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{trainMsg}</span>
        </div>
      )}

      {/* Predict error */}
      {predictStatus === 'error' && (
        <div className={`flex items-start gap-2 p-3 rounded-xl text-xs mb-3 ${
          t ? 'bg-red-600/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{predictError}</span>
        </div>
      )}

      {/* Prediction result */}
      {result && (
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className={`text-xs ${t ? 'text-slate-400' : 'text-gray-500'}`}>
                {result.regional}{result.witel ? ` / ${result.witel}` : ''} · {result.model_used}
              </p>
              <p className={`text-sm font-semibold mt-0.5 ${t ? 'text-white' : 'text-gray-900'}`}>
                Prediksi {result.forecast_period}
              </p>
            </div>
            <div className={`text-xs px-2 py-1 rounded-lg font-medium ${
              (result.change_pct ?? 0) >= 0
                ? t ? 'bg-green-600/15 text-green-400' : 'bg-green-50 text-green-700'
                : t ? 'bg-red-600/15 text-red-400'   : 'bg-red-50 text-red-700'
            }`}>
              {(result.change_pct ?? 0) >= 0 ? '+' : ''}{result.change_pct}%
            </div>
          </div>

          {/* Main prediction value */}
          <div className={`text-center py-3 rounded-lg mb-3 ${t ? 'bg-blue-600/10' : 'bg-blue-50'}`}>
            <p className={`text-2xl font-bold ${t ? 'text-blue-400' : 'text-blue-700'}`}>
              {formatValue(result.prediction, selectedMetric?.unit)}
            </p>
            <p className={`text-xs mt-1 ${t ? 'text-slate-400' : 'text-gray-500'}`}>
              Aktual {result.last_period}: {formatValue(result.last_actual, selectedMetric?.unit)}
            </p>
          </div>

          {/* Confidence interval */}
          {result.confidence_interval && (
            <div className={`grid grid-cols-2 gap-2 text-xs`}>
              <div className={`p-2 rounded-lg ${t ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                <p className={`${t ? 'text-slate-400' : 'text-gray-500'}`}>Batas Bawah ({result.confidence_interval.level})</p>
                <p className={`font-semibold mt-0.5 ${t ? 'text-slate-200' : 'text-gray-800'}`}>
                  {formatValue(result.confidence_interval.lower, selectedMetric?.unit)}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${t ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                <p className={`${t ? 'text-slate-400' : 'text-gray-500'}`}>Batas Atas ({result.confidence_interval.level})</p>
                <p className={`font-semibold mt-0.5 ${t ? 'text-slate-200' : 'text-gray-800'}`}>
                  {formatValue(result.confidence_interval.upper, selectedMetric?.unit)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ForecastPanel;
