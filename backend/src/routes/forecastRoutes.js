/**
 * forecastRoutes.js
 * Proxy dari Node.js backend (port 3001) ke Python ML service (port 8000).
 * Frontend tidak perlu tahu soal port 8000 — semua lewat /api/forecast.
 */
const express = require('express');
const http    = require('http');
const auth    = require('../middleware/auth');

const router = express.Router();

const ML_HOST = process.env.ML_SERVICE_HOST || '127.0.0.1';
const ML_PORT = parseInt(process.env.ML_SERVICE_PORT || '8000', 10);

/**
 * Kirim request ke ML service dan pipe hasilnya ke res.
 */
function proxyToML(req, res, mlPath, method = 'GET', body = null) {
  const options = {
    hostname: ML_HOST,
    port:     ML_PORT,
    path:     mlPath,
    method,
    headers:  { 'Content-Type': 'application/json' },
  };

  const mlReq = http.request(options, (mlRes) => {
    res.status(mlRes.statusCode);
    res.setHeader('Content-Type', 'application/json');
    mlRes.pipe(res);
  });

  mlReq.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'ML service tidak aktif. Jalankan: cd ml-service && uvicorn main:app --reload --port 8000',
      });
    }
    res.status(500).json({ success: false, message: err.message });
  });

  if (body) {
    mlReq.write(JSON.stringify(body));
  }
  mlReq.end();
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/** Cek status ML service */
router.get('/health', auth.authenticate, (req, res) => {
  proxyToML(req, res, '/health');
});

/** Preview data dari Oracle */
router.get('/data-preview', auth.authenticate, (req, res) => {
  const { metric, regional, witel, limit } = req.query;
  const params = new URLSearchParams();
  if (metric)   params.set('metric',   metric);
  if (regional) params.set('regional', regional);
  if (witel)    params.set('witel',    witel);
  if (limit)    params.set('limit',    limit);
  proxyToML(req, res, `/forecast/data-preview?${params}`);
});

/** List metrik & model yang tersedia */
router.get('/available-metrics', auth.authenticate, (req, res) => {
  proxyToML(req, res, '/forecast/available-metrics');
});

/** Daftar witel dari database */
router.get('/witels', auth.authenticate, (req, res) => {
  const { metric, regional } = req.query;
  const params = new URLSearchParams();
  if (metric)   params.set('metric',   metric);
  if (regional) params.set('regional', regional);
  proxyToML(req, res, `/forecast/witels?${params}`);
});

/** Status model yang sudah ditraining */
router.get('/model-status', auth.authenticate, (req, res) => {
  proxyToML(req, res, '/forecast/model-status');
});

/** Riwayat training */
router.get('/training-history', auth.authenticate, (req, res) => {
  proxyToML(req, res, '/forecast/training-history');
});

/** Trigger training (background) */
router.post('/train', auth.authenticate, (req, res) => {
  proxyToML(req, res, '/forecast/train', 'POST', req.body);
});

/** Ambil prediksi */
router.post('/predict', auth.authenticate, (req, res) => {
  proxyToML(req, res, '/forecast/predict', 'POST', req.body);
});

module.exports = router;
