import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, ChevronLeft, Loader, AlertTriangle, CheckCircle, BarChart2, History, ChevronDown, ChevronUp } from 'lucide-react';
import telkomApi from '../services/telkomApi';

// ─── Constants ─────────────────────────────────────────────────────────────────

const METRICS = [
  { value: 'order_hsi',         label: 'Order HSI',         unit: 'order',     model: 'gru'  },
  { value: 'revenue_hsi',       label: 'Revenue HSI',       unit: 'Rp',        model: 'lstm' },
  { value: 'churn_hsi',         label: 'Churn HSI',         unit: 'pelanggan', model: 'gru'  },
  { value: 'realisasi_hsi',     label: 'Realisasi HSI',     unit: 'SSL',       model: 'lstm' },
  { value: 'subscriber_hsi',    label: 'Subscriber HSI',    unit: 'pelanggan', model: 'tft'  },
  { value: 'fulfillment_rate',  label: 'Fulfillment Rate',  unit: '%',         model: 'gru'  },
  { value: 'recurring_revenue', label: 'Recurring Revenue', unit: 'Rp',        model: 'lstm' },
  { value: 'avg_install_days',  label: 'Avg Install Days',  unit: 'hari',      model: 'gru'  },
];

const REGIONALS = [
  { value: 'NASIONAL', label: 'Nasional (Semua Regional)' },
  { value: 'REG-1',    label: 'Regional 1' },
  { value: 'REG-2',    label: 'Regional 2' },
  { value: 'REG-3',    label: 'Regional 3' },
  { value: 'REG-4',    label: 'Regional 4' },
  { value: 'REG-5',    label: 'Regional 5' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(value, unit) {
  if (value === null || value === undefined) return '-';
  const rounded = Math.round(Number(value));
  if (unit === 'Rp') return `Rp ${new Intl.NumberFormat('id-ID').format(rounded)}`;
  if (unit === '%')  return `${rounded}%`;
  return `${new Intl.NumberFormat('id-ID').format(rounded)} ${unit}`;
}

function kpiBadge(ok) {
  return ok ? '✅' : '❌';
}

function generateExplanation(result, metricMeta) {
  const scope    = result.witel ? `${result.regional} / ${result.witel}` : result.regional;
  const pct      = result.change_pct ?? 0;
  const isUp     = pct >= 0;
  const absPct   = Math.abs(pct);
  const ci       = result.confidence_interval;

  // Deskripsi arah tren
  const arah = isUp ? 'meningkat' : 'menurun';
  const label = metricMeta?.label || result.metric;
  const unit  = metricMeta?.unit || '';

  // Interpretasi magnitude
  let magnitude = '';
  if (absPct < 2)       magnitude = 'relatif stabil';
  else if (absPct < 10) magnitude = `${arah} moderat sebesar ${absPct}%`;
  else if (absPct < 25) magnitude = `${arah} cukup signifikan sebesar ${absPct}%`;
  else                  magnitude = `${arah} sangat signifikan sebesar ${absPct}%`;

  // Interpretasi metrik spesifik
  let konteks = '';
  if (result.metric === 'churn_hsi' && isUp)
    konteks = 'Perlu perhatian — kenaikan churn mengindikasikan risiko kehilangan pelanggan lebih tinggi bulan depan.';
  else if (result.metric === 'churn_hsi' && !isUp)
    konteks = 'Positif — penurunan churn menunjukkan retensi pelanggan membaik.';
  else if ((result.metric === 'order_hsi' || result.metric === 'revenue_hsi') && isUp)
    konteks = 'Tren positif — pertumbuhan yang perlu dipertahankan dengan kesiapan operasional.';
  else if ((result.metric === 'order_hsi' || result.metric === 'revenue_hsi') && !isUp)
    konteks = 'Perlu investigasi — penurunan perlu dikaji apakah disebabkan faktor musiman atau penurunan struktural.';
  else if (result.metric === 'avg_install_days' && isUp)
    konteks = 'Perlu perhatian — waktu instalasi diprediksi lebih lama, dapat berdampak pada kepuasan pelanggan.';
  else if (result.metric === 'fulfillment_rate' && !isUp)
    konteks = 'Waspada — penurunan fulfillment rate mengindikasikan potensi gangguan operasional.';

  return `**Analisis Prediksi ${label} — ${scope}**

Berdasarkan model **${result.model_used}** dengan data historis hingga **${result.last_period}**, nilai ${label} pada **${result.forecast_period}** diprediksi **${magnitude}** dari ${formatValue(result.last_actual, unit)} menjadi **${formatValue(result.prediction, unit)}**.

Rentang kepercayaan ${ci?.level}: **${formatValue(ci?.lower, unit)} – ${formatValue(ci?.upper, unit)}**.

${konteks}`;
}

// ─── Training History Table ────────────────────────────────────────────────────

const HistoryTable = ({ theme }) => {
  const t = theme === 'dark';
  const [open, setOpen]       = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    telkomApi.getTrainingHistory()
      .then(d => setHistory(d.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (open) load(); }, [open]);

  const thCls = `px-2 py-1.5 text-left text-xs font-semibold ${t ? 'text-slate-400' : 'text-gray-500'}`;
  const tdCls = `px-2 py-1.5 text-xs ${t ? 'text-slate-300' : 'text-gray-700'}`;

  return (
    <div className={`rounded-xl border mt-3 overflow-hidden ${t ? 'border-slate-700/60' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
          t ? 'bg-slate-800/60 hover:bg-slate-700/60' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <History className={`w-4 h-4 ${t ? 'text-slate-400' : 'text-gray-500'}`} />
          <span className={`text-xs font-semibold ${t ? 'text-slate-300' : 'text-gray-700'}`}>
            Riwayat Training
          </span>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <button
              onClick={e => { e.stopPropagation(); load(); }}
              className={`text-xs px-2 py-0.5 rounded ${t ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
            >
              Refresh
            </button>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {open && (
        <div className={`overflow-x-auto ${t ? 'bg-slate-900/40' : 'bg-white'}`}>
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-400">
              <Loader className="w-3.5 h-3.5 animate-spin" /> Memuat...
            </div>
          ) : history.length === 0 ? (
            <p className={`px-3 py-4 text-xs ${t ? 'text-slate-500' : 'text-gray-400'}`}>
              Belum ada riwayat training.
            </p>
          ) : (
            <table className="w-full min-w-max">
              <thead>
                <tr className={`border-b ${t ? 'border-slate-700' : 'border-gray-200'}`}>
                  <th className={thCls}>Tanggal</th>
                  <th className={thCls}>Metrik</th>
                  <th className={thCls}>Regional</th>
                  <th className={thCls}>Witel</th>
                  <th className={thCls}>Model</th>
                  <th className={thCls}>Bulan Data</th>
                  <th className={thCls}>Window</th>
                  <th className={thCls}>sMAPE (short)</th>
                  <th className={thCls}>MASE</th>
                  <th className={thCls}>Skill</th>
                  <th className={thCls}>KPI</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const vm  = h.val_metrics || {};
                  const kpi = vm.kpi || {};
                  const allPass = kpi.mase_ok && kpi.smape_short_ok && kpi.skill_ok;
                  return (
                    <tr
                      key={i}
                      className={`border-b transition-colors ${
                        t ? 'border-slate-800 hover:bg-slate-800/40' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <td className={tdCls}>{h.trained_at?.slice(0, 16) || '-'}</td>
                      <td className={tdCls}>{h.metric}</td>
                      <td className={tdCls}>{h.regional}</td>
                      <td className={tdCls}>{h.witel || '-'}</td>
                      <td className={`${tdCls} font-medium uppercase`}>{h.model_type}</td>
                      <td className={tdCls}>{h.data_points} bln</td>
                      <td className={tdCls}>{h.window_size || '-'}</td>
                      <td className={tdCls}>{vm.smape?.toFixed(1)}%</td>
                      <td className={tdCls}>{vm.mase?.toFixed(3)}</td>
                      <td className={tdCls}>{vm.skill_score?.toFixed(3)}</td>
                      <td className={tdCls}>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          allPass
                            ? t ? 'bg-green-600/20 text-green-400' : 'bg-green-50 text-green-700'
                            : t ? 'bg-yellow-600/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {allPass ? 'PASS' : 'PARTIAL'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

// ─── ForecastPanel ──────────────────────────────────────────────────────────────

const ForecastPanel = ({ theme, onBack, onSendToChat }) => {
  const t = theme === 'dark';

  const [metric, setMetric]         = useState('order_hsi');
  const [regional, setRegional]     = useState('NASIONAL');
  const [witel, setWitel]           = useState('');
  const [modelOverride, setModelOverride] = useState('');

  const [witels, setWitels]               = useState([]);
  const [witelsLoading, setWitelsLoading] = useState(false);

  useEffect(() => {
    if (regional === 'NASIONAL') { setWitels([]); setWitel(''); return; }
    setWitelsLoading(true);
    setWitel('');
    telkomApi.getWitels(metric, regional)
      .then(res => setWitels(res.witels || []))
      .catch(() => setWitels([]))
      .finally(() => setWitelsLoading(false));
  }, [metric, regional]);

  const [trainStatus, setTrainStatus] = useState(null);
  const [trainMsg, setTrainMsg]       = useState('');
  const [trainEpochs, setTrainEpochs] = useState(300);
  const [windowSize, setWindowSize]   = useState(0); // 0 = auto
  const [trainDone, setTrainDone]     = useState(false); // popup selesai
  const pollRef = useRef(null);
  const [predictStatus, setPredictStatus] = useState(null);
  const [result, setResult]           = useState(null);
  const [explanation, setExplanation] = useState('');
  const [predictError, setPredictError]   = useState('');

  const selectedMetric = METRICS.find(m => m.value === metric);
  const activeModel    = modelOverride || selectedMetric.model;

  const handleTrain = async () => {
    setTrainStatus('loading');
    setTrainMsg('Training dimulai di background...');
    setTrainDone(false);
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      await telkomApi.trainForecastModel({
        model_type: activeModel, metric, regional, witel: witel || null,
        epochs: trainEpochs, window_size: windowSize,
      });

      // Simpan timestamp mulai training
      const startedAt = new Date().toISOString();

      // Polling setiap 5 detik sampai ada entry baru di training history
      pollRef.current = setInterval(async () => {
        try {
          const hist = await telkomApi.getTrainingHistory();
          const entries = hist.history || [];
          const found = entries.find(h =>
            h.metric === metric &&
            h.regional === (regional || 'NASIONAL') &&
            (h.witel || null) === (witel || null) &&
            h.trained_at > startedAt.slice(0, 19).replace('T', ' ')
          );
          if (found) {
            clearInterval(pollRef.current);
            setTrainStatus('done');
            setTrainDone(true);
            // Log detail ke console untuk developer, bukan ditampilkan ke user
            console.log('[Training selesai]', found.val_metrics);
            setTrainMsg('Model berhasil diperbarui. Anda dapat melakukan prediksi sekarang.');
          }
        } catch {}
      }, 5000);

      // Stop polling setelah 15 menit
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          if (trainStatus === 'loading') {
            setTrainStatus('error');
            setTrainMsg('Training timeout. Cek log ML service.');
          }
        }
      }, 15 * 60 * 1000);

    } catch (e) {
      setTrainStatus('error');
      setTrainMsg(e.message || 'Gagal memulai training.');
    }
  };

  // Cleanup polling saat unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handlePredict = async () => {
    setPredictStatus('loading');
    setPredictError('');
    setResult(null);
    try {
      const res = await telkomApi.predictForecast({
        model_type: activeModel, metric, regional, witel: witel || null,
      });
      setPredictStatus('done');
      setResult(res.result);
      setExplanation(generateExplanation(res.result, selectedMetric));

      // Kirim ke chat utama sebagai pesan tersimpan + dijawab AI
      if (onSendToChat && res.result) {
        const r = res.result;
        const payload = {
          metric:      r.metric,
          metricLabel: selectedMetric.label,
          unit:        selectedMetric.unit,
          regional:    r.regional,
          witel:       r.witel,
          model:       r.model_used,
          lastPeriod:  r.last_period,
          lastActual:  r.last_actual,
          forecastPeriod: r.forecast_period,
          prediction:  r.prediction,
          changePct:   r.change_pct,
          ciLevel:     r.confidence_interval?.level,
          ciLower:     r.confidence_interval?.lower,
          ciUpper:     r.confidence_interval?.upper,
          inferenceMs: r.inference_ms,
        };
        onSendToChat(`__FORECAST__:${JSON.stringify(payload)}`);
      }
    } catch (e) {
      setPredictStatus('error');
      setPredictError(e.message || 'Gagal mendapatkan prediksi. Pastikan model sudah ditraining.');
    }
  };

  // ─── Styles ───────────────────────────────────────────────────────────────────
  const card       = `rounded-xl border p-4 ${t ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-gray-200'}`;
  const label      = `text-xs font-semibold uppercase tracking-wider mb-1.5 ${t ? 'text-slate-400' : 'text-gray-500'}`;
  const select     = `w-full rounded-lg px-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${t ? 'bg-slate-900/60 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`;
  const btnPrimary = 'flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const btnSecondary = `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${t ? 'bg-slate-700/40 border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`;

  return (
    <div className={`px-4 pb-4 pt-3 border-t ${t ? 'border-slate-700/50' : 'border-gray-200/70'}`}>

      {/* Toast: Training Selesai */}
      {trainDone && (
        <div className={`fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm max-w-sm
          ${t ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-gray-200 text-gray-800'}`}>
          <CheckCircle className={`w-5 h-5 shrink-0 mt-0.5 ${t ? 'text-blue-400' : 'text-blue-600'}`} />
          <div>
            <p className="font-semibold mb-0.5">Training Model Selesai</p>
            <p className="text-xs opacity-70">{trainMsg}</p>
          </div>
          <button onClick={() => setTrainDone(false)} className="ml-2 opacity-40 hover:opacity-80 text-lg leading-none">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${t ? 'text-blue-400' : 'text-blue-600'}`} />
          <p className={`text-xs font-semibold uppercase tracking-wider ${t ? 'text-slate-400' : 'text-gray-500'}`}>
            Prediksi 1 Bulan Kedepan
          </p>
        </div>
        <button onClick={onBack} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ${t ? 'text-slate-400 hover:text-white hover:bg-slate-700/60' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
          <ChevronLeft className="w-3 h-3" /> Kembali
        </button>
      </div>

      {/* Form */}
      <div className="space-y-3 mb-4">
        {/* Metric */}
        <div>
          <p className={label}>Metrik</p>
          <select value={metric} onChange={e => { setMetric(e.target.value); setResult(null); setPredictStatus(null); setModelOverride(''); }} className={select}>
            {METRICS.map(m => <option key={m.value} value={m.value}>{m.label} ({m.unit})</option>)}
          </select>
          {/* Model selector */}
          <div className="flex gap-1.5 mt-2">
            {['', 'gru', 'lstm'].map(m => (
              <button key={m} onClick={() => { setModelOverride(m); setResult(null); setPredictStatus(null); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  (m === '' ? modelOverride === '' : modelOverride === m)
                    ? t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-500 border-blue-400 text-white'
                    : t ? 'bg-slate-700/40 border-slate-600 text-slate-400 hover:text-white' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                }`}>
                {m === '' ? `Auto (${selectedMetric?.model?.toUpperCase()})` : m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Regional */}
        <div>
          <p className={label}>Regional</p>
          <select value={regional} onChange={e => { setRegional(e.target.value); setResult(null); setPredictStatus(null); }} className={select}>
            {REGIONALS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Witel dropdown dari database */}
        {regional !== 'NASIONAL' && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <p className={label} style={{ marginBottom: 0 }}>Witel</p>
              <span className={`text-xs font-normal ${t ? 'text-slate-500' : 'text-gray-400'}`}>(opsional)</span>
              {witelsLoading && <Loader className={`w-3 h-3 animate-spin ${t ? 'text-slate-400' : 'text-gray-400'}`} />}
            </div>
            <select value={witel} onChange={e => { setWitel(e.target.value); setResult(null); setPredictStatus(null); }} className={select} disabled={witelsLoading}>
              <option value="">— Level Regional (tanpa witel) —</option>
              {witels.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Training hyperparameters */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <label className={`block text-xs mb-1 ${t ? 'text-slate-400' : 'text-gray-500'}`}>
            Max Epochs
          </label>
          <input type="number" min={10} max={500} value={trainEpochs} onChange={e => setTrainEpochs(Number(e.target.value))}
            className={`w-full text-xs px-2 py-1.5 rounded-lg border ${t ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`} />
          <p className={`text-xs mt-0.5 ${t ? 'text-slate-500' : 'text-gray-400'}`}>Early stopping aktif</p>
        </div>
        <div className="flex-1">
          <label className={`block text-xs mb-1 ${t ? 'text-slate-400' : 'text-gray-500'}`}>
            Window (bulan)
          </label>
          <input type="number" min={0} max={36} value={windowSize} onChange={e => setWindowSize(Number(e.target.value))}
            className={`w-full text-xs px-2 py-1.5 rounded-lg border ${t ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`} />
          <p className={`text-xs mt-0.5 ${t ? 'text-slate-500' : 'text-gray-400'}`}>0 = auto-tune</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={handleTrain} disabled={trainStatus === 'loading'} className={btnSecondary}>
          {trainStatus === 'loading' ? <Loader className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
          Training Model
        </button>
        <button onClick={handlePredict} disabled={predictStatus === 'loading'} className={btnPrimary}>
          {predictStatus === 'loading' ? <Loader className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          Prediksi
        </button>
      </div>

      {/* Train status */}
      {trainStatus && trainStatus !== 'loading' && (
        <div className={`flex items-start gap-2 p-3 rounded-xl text-xs mb-3 ${
          trainStatus === 'done'
            ? t ? 'bg-green-600/10 border border-green-500/30 text-green-400' : 'bg-green-50 border border-green-200 text-green-700'
            : t ? 'bg-red-600/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {trainStatus === 'done' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{trainMsg}</span>
        </div>
      )}

      {/* Predict error */}
      {predictStatus === 'error' && (
        <div className={`flex items-start gap-2 p-3 rounded-xl text-xs mb-3 ${t ? 'bg-red-600/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{predictError}</span>
        </div>
      )}

      {/* Prediction result card */}
      {result && (
        <div className={`${card} mb-2`}>
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
                : t ? 'bg-red-600/15 text-red-400' : 'bg-red-50 text-red-700'
            }`}>
              {(result.change_pct ?? 0) >= 0 ? '+' : ''}{result.change_pct}%
            </div>
          </div>

          <div className={`text-center py-3 rounded-lg mb-3 ${t ? 'bg-blue-600/10' : 'bg-blue-50'}`}>
            <p className={`text-2xl font-bold ${t ? 'text-blue-400' : 'text-blue-700'}`}>
              {formatValue(result.prediction, selectedMetric?.unit)}
            </p>
            <p className={`text-xs mt-1 ${t ? 'text-slate-400' : 'text-gray-500'}`}>
              Aktual {result.last_period}: {formatValue(result.last_actual, selectedMetric?.unit)}
            </p>
          </div>

          {result.confidence_interval && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`p-2 rounded-lg ${t ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                <p className={t ? 'text-slate-400' : 'text-gray-500'}>Batas Bawah ({result.confidence_interval.level})</p>
                <p className={`font-semibold mt-0.5 ${t ? 'text-slate-200' : 'text-gray-800'}`}>
                  {formatValue(result.confidence_interval.lower, selectedMetric?.unit)}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${t ? 'bg-slate-700/40' : 'bg-gray-50'}`}>
                <p className={t ? 'text-slate-400' : 'text-gray-500'}>Batas Atas ({result.confidence_interval.level})</p>
                <p className={`font-semibold mt-0.5 ${t ? 'text-slate-200' : 'text-gray-800'}`}>
                  {formatValue(result.confidence_interval.upper, selectedMetric?.unit)}
                </p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Penjelasan template NLG */}
      {explanation && (
        <div className={`rounded-xl border p-3 mb-2 text-xs leading-relaxed ${
          t ? 'bg-slate-800/40 border-slate-700/50 text-slate-300' : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}>
          {explanation.split('\n').map((line, i) => {
            if (!line.trim()) return <div key={i} className="h-2" />;
            // bold **text**
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
              <p key={i} className="mb-0.5">
                {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
              </p>
            );
          })}
        </div>
      )}

      {/* Training history table */}
      <HistoryTable theme={theme} />
    </div>
  );
};

export default ForecastPanel;
