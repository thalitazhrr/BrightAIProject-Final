"""
config.py
Membaca konfigurasi dari backend/.env (kredensial Oracle sama persis).
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Pakai .env yang sudah ada di backend — tidak perlu file terpisah
_backend_env = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(_backend_env)

# ── Oracle ────────────────────────────────────────────────────────────────────
DB_USER            = os.getenv("ORACLE_DADBS_USER", "usr_rpt")
DB_PASSWORD        = os.getenv("ORACLE_DADBS_PASSWORD", "")
DB_DSN             = os.getenv("ORACLE_DADBS_CONNECT_STRING", "10.62.165.144:1521/DADBS")
INSTANT_CLIENT_DIR = os.getenv("ORACLE_INSTANT_CLIENT_PATH", "")

# ── Schema ────────────────────────────────────────────────────────────────────
SCHEMA_SALES   = "DWH_MOIS.BRIGHTAI_SALES"
SCHEMA_REVENUE = "DWH_MOIS.BRIGHTAI_REVENUE"
SCHEMA_CHURN   = "DWH_MOIS.BRIGHTAI_CT0_NAL"
SCHEMA_TARGET  = "DWH_MOIS.BRIGHTAI_TARGET"
SCHEMA_DAPROS  = "DWH_MOIS.BRIGHTAI_DAPROS"

# ── Model storage ─────────────────────────────────────────────────────────────
SAVED_MODELS_DIR = Path(__file__).parent / "saved_models"
SAVED_MODELS_DIR.mkdir(exist_ok=True)

# ── Training defaults ─────────────────────────────────────────────────────────
WINDOW_SIZE   = 12   # bulan historis sebagai input
HORIZON       = 1    # bulan yang diprediksi
EPOCHS        = 100
BATCH_SIZE    = 32
LEARNING_RATE = 1e-3
HIDDEN_SIZE   = 64
NUM_LAYERS    = 2
DROPOUT       = 0.2

# ── FastAPI ───────────────────────────────────────────────────────────────────
ML_SERVICE_PORT = 8000
ML_SERVICE_HOST = "0.0.0.0"
