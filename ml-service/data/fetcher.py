"""
data/fetcher.py
Mengambil data time series bulanan dari Oracle untuk training dan inference.

Regional format per tabel:
  BRIGHTAI_SALES    → REGIONAL = '1'..'5',    WITEL = nama witel
  BRIGHTAI_CT0_NAL  → REGIONAL = '1'..'5',    WITEL = nama witel
  BRIGHTAI_REVENUE  → REGIONAL_BILL = 'REG-1'..'REG-5', WITEL_BILL = nama witel
  BRIGHTAI_DAPROS   → REGIONAL = 'REG-1'..'REG-5', WITEL = nama witel  (belum dipakai ML)
  BRIGHTAI_TARGET   → TREG = 'REG-1'..'REG-5', WITEL = nama witel      (belum dipakai ML)

Input API menerima format bebas: '1', 'REG-1', 'TREG1' — dinormalisasi di sini.
Semua query hanya SELECT — tidak ada perubahan data.
"""
from __future__ import annotations

import oracledb
import pandas as pd
import logging
from typing import Optional

import config

logger = logging.getLogger(__name__)

# ── Init Oracle client sekali saat modul di-import ────────────────────────────
_client_initialized = False


def _init_client():
    global _client_initialized
    if _client_initialized:
        return
    if config.INSTANT_CLIENT_DIR:
        try:
            oracledb.init_oracle_client(lib_dir=config.INSTANT_CLIENT_DIR)
            logger.info(f"Oracle Thick mode: {config.INSTANT_CLIENT_DIR}")
        except Exception as e:
            logger.warning(f"Thick mode gagal, pakai Thin mode: {e}")
    _client_initialized = True


def _get_conn() -> oracledb.Connection:
    _init_client()
    return oracledb.connect(
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        dsn=config.DB_DSN
    )


def _query(sql: str) -> pd.DataFrame:
    """Eksekusi SELECT dan kembalikan DataFrame."""
    conn = _get_conn()
    try:
        df = pd.read_sql(sql, conn)
        df.columns = [c.lower() for c in df.columns]
        return df
    finally:
        conn.close()


# ── Normalisasi regional ───────────────────────────────────────────────────────

def _to_numeric_regional(regional: str) -> str:
    """
    Normalisasi format regional input ke angka '1'-'5'.
    Menerima: '1', 'REG-1', 'TREG1', 'reg-2', 'treg3', dll.
    """
    r = regional.strip().upper()
    if r in ("1", "2", "3", "4", "5"):
        return r
    if r.startswith("REG-") and r[4:] in ("1", "2", "3", "4", "5"):
        return r[4:]
    if r.startswith("TREG") and r[4:] in ("1", "2", "3", "4", "5"):
        return r[4:]
    return r  # fallback: pakai apa adanya


def _to_reg_format(regional: str) -> str:
    """
    Normalisasi ke format 'REG-N' untuk tabel REVENUE / DAPROS / TARGET.
    Input: '1', 'REG-1', 'TREG1', dll.
    """
    n = _to_numeric_regional(regional)
    if n in ("1", "2", "3", "4", "5"):
        return f"REG-{n}"
    return regional.strip().upper()  # fallback


def regional_display(regional: Optional[str]) -> str:
    """Label regional yang konsisten untuk disimpan di model dan response."""
    if regional is None:
        return "NASIONAL"
    r = regional.strip().upper()
    if r == "NASIONAL":
        return "NASIONAL"
    n = _to_numeric_regional(regional)
    return f"REG-{n}" if n in ("1", "2", "3", "4", "5") else r


# ── WHERE clause helpers ───────────────────────────────────────────────────────

def _where_numeric(col: str, regional: Optional[str]) -> str:
    """WHERE clause untuk kolom dengan format angka: REGIONAL = '1'."""
    if not regional:
        return ""
    n = _to_numeric_regional(regional)
    return f"AND {col} = '{n}'"


def _where_reg_format(col: str, regional: Optional[str]) -> str:
    """WHERE clause untuk kolom dengan format REG-N: REGIONAL_BILL = 'REG-1'."""
    if not regional:
        return ""
    val = _to_reg_format(regional)
    return f"AND {col} = '{val}'"


def _where_witel(col: str, witel: Optional[str]) -> str:
    if not witel:
        return ""
    # Escape single quotes untuk Oracle (double the quote)
    safe = witel.strip().replace("'", "''")
    return f"AND {col} = '{safe}'"


# ── Helpers tambahan untuk TARGET & DAPROS ────────────────────────────────────

def _where_treg(regional: Optional[str]) -> str:
    """WHERE clause untuk BRIGHTAI_TARGET — kolom TREG format REG-N."""
    if not regional:
        return ""
    val = _to_reg_format(regional)
    return f"AND TREG = '{val}'"


# ── Query per metrik ───────────────────────────────────────────────────────────

def fetch_order_hsi(
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Monthly total order HSI (Bisnis + Basic) yang fulfilled.
    Sumber: BRIGHTAI_SALES — REGIONAL '1'..'5', WITEL = nama witel.
    Kolom output: periode, regional, witel, value
    """
    w_regional = _where_numeric("REGIONAL", regional)
    w_witel    = _where_witel("WITEL", witel)

    # Granularitas GROUP BY menyesuaikan filter yang aktif
    if witel:
        group_regional = "REGIONAL, WITEL"
        select_regional = "REGIONAL AS regional, WITEL AS witel"
    else:
        group_regional = "REGIONAL"
        select_regional = "REGIONAL AS regional, NULL AS witel"

    sql = f"""
        SELECT
            TO_CHAR(ORDER_DATE, 'YYYY-MM')       AS periode,
            EXTRACT(YEAR  FROM ORDER_DATE)        AS year_id,
            EXTRACT(MONTH FROM ORDER_DATE)        AS month_id,
            {select_regional},
            COUNT(DISTINCT ORDER_ID)              AS value
        FROM {config.SCHEMA_SALES}
        WHERE STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
          AND ORDER_DATE IS NOT NULL
          AND (
              UPPER(PACKAGE_NAME) LIKE '%HSIE%'
              OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
              OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
              OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
              OR UPPER(PACKAGE_NAME) LIKE '%INETF%'
          )
          AND PRODUCT != 'WMS'
          {w_regional}
          {w_witel}
        GROUP BY
            TO_CHAR(ORDER_DATE, 'YYYY-MM'),
            EXTRACT(YEAR  FROM ORDER_DATE),
            EXTRACT(MONTH FROM ORDER_DATE),
            {group_regional}
        ORDER BY year_id, month_id, regional
    """
    df = _query(sql)
    df["periode"] = pd.to_datetime(df["periode"], format="%Y-%m")
    # Normalisasi regional ke format REG-N
    df["regional"] = df["regional"].apply(
        lambda x: f"REG-{x}" if str(x).strip() in ("1","2","3","4","5") else str(x)
    )
    return df


def fetch_revenue_hsi(
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Monthly total revenue HSI.
    Sumber: BRIGHTAI_REVENUE — REGIONAL_BILL 'REG-1'..'REG-5', WITEL_BILL.
    Kolom output: periode, regional, witel, value
    """
    w_regional = _where_reg_format("REGIONAL_BILL", regional)
    w_witel    = _where_witel("WITEL_BILL", witel)

    if witel:
        group_regional = "YEAR_ID, MONTH_ID, REGIONAL_BILL, WITEL_BILL"
        select_regional = "REGIONAL_BILL AS regional, WITEL_BILL AS witel"
    else:
        group_regional = "YEAR_ID, MONTH_ID, REGIONAL_BILL"
        select_regional = "REGIONAL_BILL AS regional, NULL AS witel"

    sql = f"""
        SELECT
            YEAR_ID                               AS year_id,
            MONTH_ID                              AS month_id,
            {select_regional},
            SUM(REVENUE)                          AS value
        FROM {config.SCHEMA_REVENUE}
        WHERE GROUP4 = 'High Speed Internet'
          AND REVENUE > 0
          AND REGIONAL_BILL IS NOT NULL
          {w_regional}
          {w_witel}
        GROUP BY {group_regional}
        ORDER BY year_id, month_id, regional
    """
    df = _query(sql)
    df["periode"] = pd.to_datetime(
        df["year_id"].astype(str) + "-" + df["month_id"].astype(str).str.zfill(2),
        format="%Y-%m"
    )
    return df


def fetch_churn_hsi(
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Monthly churn count (CT0) HSI.
    Sumber: BRIGHTAI_CT0_NAL — REGIONAL '1'..'5', WITEL = nama witel.
    Kolom output: periode, regional, witel, value
    """
    w_regional = _where_numeric("REGIONAL", regional)
    w_witel    = _where_witel("WITEL", witel)

    if witel:
        group_regional = "REGIONAL, WITEL"
        select_regional = "REGIONAL AS regional, WITEL AS witel"
    else:
        group_regional = "REGIONAL"
        select_regional = "REGIONAL AS regional, NULL AS witel"

    sql = f"""
        SELECT
            EXTRACT(YEAR  FROM TANGGAL_CHURN)     AS year_id,
            EXTRACT(MONTH FROM TANGGAL_CHURN)     AS month_id,
            TO_CHAR(TANGGAL_CHURN, 'YYYY-MM')     AS periode,
            {select_regional},
            COUNT(DISTINCT NCLI)                  AS value
        FROM {config.SCHEMA_CHURN}
        WHERE TANGGAL_CHURN IS NOT NULL
          {w_regional}
          {w_witel}
        GROUP BY
            EXTRACT(YEAR  FROM TANGGAL_CHURN),
            EXTRACT(MONTH FROM TANGGAL_CHURN),
            TO_CHAR(TANGGAL_CHURN, 'YYYY-MM'),
            {group_regional}
        ORDER BY year_id, month_id, regional
    """
    df = _query(sql)
    df["periode"] = pd.to_datetime(df["periode"], format="%Y-%m")
    df["regional"] = df["regional"].apply(
        lambda x: f"REG-{x}" if str(x).strip() in ("1","2","3","4","5") else str(x)
    )
    return df


def fetch_realisasi_hsi(
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Monthly realisasi HSI dari tabel TARGET.
    Sumber: BRIGHTAI_TARGET — TREG 'REG-1'..'REG-5', WITEL.
    PERIODE format YYYYMM, SATUAN='SSL' (layanan terpasang).
    Kolom output: periode, regional, witel, value
    """
    w_regional = _where_treg(regional)
    w_witel    = _where_witel("WITEL", witel)

    if witel:
        group_cols   = "PERIODE, TREG, WITEL"
        select_extra = "TREG AS regional, WITEL AS witel"
    else:
        group_cols   = "PERIODE, TREG"
        select_extra = "TREG AS regional, NULL AS witel"

    sql = f"""
        SELECT
            PERIODE,
            {select_extra},
            SUM(REALISASI) AS value
        FROM {config.SCHEMA_TARGET}
        WHERE UPPER(PRODUK) = 'HSI'
          AND SATUAN = 'SSL'
          AND REALISASI IS NOT NULL
          AND TREG IS NOT NULL
          {w_regional}
          {w_witel}
        GROUP BY {group_cols}
        ORDER BY PERIODE, regional
    """
    df = _query(sql)
    # PERIODE format YYYYMM → datetime
    df["periode"] = pd.to_datetime(df["periode"].astype(str), format="%Y%m")
    return df


def fetch_subscriber_hsi(
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Monthly active subscribers HSI dari snapshot DAPROS.
    Sumber: BRIGHTAI_DAPROS — REGIONAL 'REG-1'..'REG-5', WITEL.
    PERIOD format YYYYMM.
    Kolom output: periode, regional, witel, value
    """
    w_regional = _where_reg_format("REGIONAL", regional)
    w_witel    = _where_witel("WITEL", witel)

    if witel:
        group_cols   = "PERIOD, REGIONAL, WITEL"
        select_extra = "REGIONAL AS regional, WITEL AS witel"
    else:
        group_cols   = "PERIOD, REGIONAL"
        select_extra = "REGIONAL AS regional, NULL AS witel"

    sql = f"""
        SELECT
            PERIOD,
            {select_extra},
            COUNT(DISTINCT NCLI) AS value
        FROM {config.SCHEMA_DAPROS}
        WHERE PLBLCL IN ('BL', 'CL')
          AND CITEM NOT LIKE '%W/%'
          AND CITEM NOT LIKE '%WM%'
          AND PERIOD IS NOT NULL
          AND REGIONAL IS NOT NULL
          {w_regional}
          {w_witel}
        GROUP BY {group_cols}
        ORDER BY PERIOD, regional
    """
    df = _query(sql)
    df["periode"] = pd.to_datetime(df["period"].astype(str), format="%Y%m")
    df = df.drop(columns=["period"])
    return df


def fetch_fulfillment_rate(
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Monthly fulfillment rate HSI (ps_006).
    = fulfilled orders / total orders × 100, per REGIONAL/WITEL.
    Sumber: BRIGHTAI_SALES.
    Kolom output: periode, regional, witel, value (0-100 %)
    """
    w_regional = _where_numeric("REGIONAL", regional)
    w_witel    = _where_witel("WITEL", witel)

    if witel:
        group_regional = "REGIONAL, WITEL"
        select_regional = "REGIONAL AS regional, WITEL AS witel"
    else:
        group_regional = "REGIONAL"
        select_regional = "REGIONAL AS regional, NULL AS witel"

    sql = f"""
        SELECT
            TO_CHAR(ORDER_DATE, 'YYYY-MM')       AS periode,
            EXTRACT(YEAR  FROM ORDER_DATE)        AS year_id,
            EXTRACT(MONTH FROM ORDER_DATE)        AS month_id,
            {select_regional},
            ROUND(
                COUNT(CASE WHEN STATUS_RESUME IN (
                    'FULFILL BILLING COMPLETED', 'Completed (PS)'
                ) THEN 1 END) * 100.0
                / NULLIF(COUNT(ORDER_ID), 0),
            2)                                    AS value
        FROM {config.SCHEMA_SALES}
        WHERE ORDER_DATE IS NOT NULL
          AND (
              UPPER(PACKAGE_NAME) LIKE '%HSIE%'
              OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
              OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
              OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
              OR UPPER(PACKAGE_NAME) LIKE '%INETF%'
          )
          AND PRODUCT != 'WMS'
          {w_regional}
          {w_witel}
        GROUP BY
            TO_CHAR(ORDER_DATE, 'YYYY-MM'),
            EXTRACT(YEAR  FROM ORDER_DATE),
            EXTRACT(MONTH FROM ORDER_DATE),
            {group_regional}
        ORDER BY year_id, month_id, regional
    """
    df = _query(sql)
    df["periode"] = pd.to_datetime(df["periode"], format="%Y-%m")
    df["regional"] = df["regional"].apply(
        lambda x: f"REG-{x}" if str(x).strip() in ("1","2","3","4","5") else str(x)
    )
    return df


def fetch_recurring_revenue(
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Monthly recurring revenue HSI (mart_004).
    = SUM(REVENUE) WHERE FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING'.
    Sumber: BRIGHTAI_REVENUE.
    Kolom output: periode, regional, witel, value
    """
    w_regional = _where_reg_format("REGIONAL_BILL", regional)
    w_witel    = _where_witel("WITEL_BILL", witel)

    if witel:
        group_regional = "YEAR_ID, MONTH_ID, REGIONAL_BILL, WITEL_BILL"
        select_regional = "REGIONAL_BILL AS regional, WITEL_BILL AS witel"
    else:
        group_regional = "YEAR_ID, MONTH_ID, REGIONAL_BILL"
        select_regional = "REGIONAL_BILL AS regional, NULL AS witel"

    sql = f"""
        SELECT
            YEAR_ID                               AS year_id,
            MONTH_ID                              AS month_id,
            {select_regional},
            SUM(REVENUE)                          AS value
        FROM {config.SCHEMA_REVENUE}
        WHERE FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING'
          AND GROUP4 = 'High Speed Internet'
          AND REVENUE > 0
          AND REGIONAL_BILL IS NOT NULL
          {w_regional}
          {w_witel}
        GROUP BY {group_regional}
        ORDER BY year_id, month_id, regional
    """
    df = _query(sql)
    df["periode"] = pd.to_datetime(
        df["year_id"].astype(str) + "-" + df["month_id"].astype(str).str.zfill(2),
        format="%Y-%m"
    )
    return df


def fetch_avg_install_days(
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Monthly avg installation time HSI in days (ps_007).
    = AVG(TGL_PS - ORDER_DATE) per REGIONAL/WITEL.
    Sumber: BRIGHTAI_SALES.
    Kolom output: periode, regional, witel, value (hari)
    """
    w_regional = _where_numeric("REGIONAL", regional)
    w_witel    = _where_witel("WITEL", witel)

    if witel:
        group_regional = "REGIONAL, WITEL"
        select_regional = "REGIONAL AS regional, WITEL AS witel"
    else:
        group_regional = "REGIONAL"
        select_regional = "REGIONAL AS regional, NULL AS witel"

    sql = f"""
        SELECT
            TO_CHAR(ORDER_DATE, 'YYYY-MM')        AS periode,
            EXTRACT(YEAR  FROM ORDER_DATE)         AS year_id,
            EXTRACT(MONTH FROM ORDER_DATE)         AS month_id,
            {select_regional},
            ROUND(AVG(TGL_PS - ORDER_DATE), 2)    AS value
        FROM {config.SCHEMA_SALES}
        WHERE STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
          AND ORDER_DATE IS NOT NULL
          AND TGL_PS IS NOT NULL
          AND TGL_PS >= ORDER_DATE
          AND (TGL_PS - ORDER_DATE) <= 365
          AND (
              UPPER(PACKAGE_NAME) LIKE '%HSIE%'
              OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
              OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
              OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
              OR UPPER(PACKAGE_NAME) LIKE '%INETF%'
          )
          AND PRODUCT != 'WMS'
          {w_regional}
          {w_witel}
        GROUP BY
            TO_CHAR(ORDER_DATE, 'YYYY-MM'),
            EXTRACT(YEAR  FROM ORDER_DATE),
            EXTRACT(MONTH FROM ORDER_DATE),
            {group_regional}
        ORDER BY year_id, month_id, regional
    """
    df = _query(sql)
    df["periode"] = pd.to_datetime(df["periode"], format="%Y-%m")
    df["regional"] = df["regional"].apply(
        lambda x: f"REG-{x}" if str(x).strip() in ("1","2","3","4","5") else str(x)
    )
    return df


# ── Registry fungsi fetch ─────────────────────────────────────────────────────
FETCH_REGISTRY = {
    "order_hsi":         fetch_order_hsi,
    "revenue_hsi":       fetch_revenue_hsi,
    "churn_hsi":         fetch_churn_hsi,
    "realisasi_hsi":     fetch_realisasi_hsi,
    "subscriber_hsi":    fetch_subscriber_hsi,
    "fulfillment_rate":  fetch_fulfillment_rate,
    "recurring_revenue": fetch_recurring_revenue,
    "avg_install_days":  fetch_avg_install_days,
}


# ── Helper: pivot ke national ─────────────────────────────────────────────────
def aggregate_national(df: pd.DataFrame) -> pd.DataFrame:
    """Jumlahkan semua regional/witel → series nasional."""
    national = (
        df.groupby("periode")["value"]
        .sum()
        .reset_index()
        .sort_values("periode")
    )
    national["regional"] = "NASIONAL"
    national["witel"]    = None
    return national


# ── Daftar witel dari database ────────────────────────────────────────────────

# Mapping metric → (table, witel_col, regional_col, regional_format)
_WITEL_SOURCE = {
    "order_hsi":         (config.SCHEMA_SALES,   "WITEL",      "REGIONAL",      "numeric"),
    "fulfillment_rate":  (config.SCHEMA_SALES,   "WITEL",      "REGIONAL",      "numeric"),
    "avg_install_days":  (config.SCHEMA_SALES,   "WITEL",      "REGIONAL",      "numeric"),
    "churn_hsi":         (config.SCHEMA_CHURN,   "WITEL",      "REGIONAL",      "numeric"),
    "revenue_hsi":       (config.SCHEMA_REVENUE, "WITEL_BILL", "REGIONAL_BILL", "reg"),
    "recurring_revenue": (config.SCHEMA_REVENUE, "WITEL_BILL", "REGIONAL_BILL", "reg"),
    "realisasi_hsi":     (config.SCHEMA_TARGET,  "WITEL",      "TREG",          "reg"),
    "subscriber_hsi":    (config.SCHEMA_DAPROS,  "WITEL",      "REGIONAL",      "reg"),
}


def get_witels(metric: str, regional: Optional[str] = None) -> list[str]:
    """
    Ambil daftar witel unik dari database untuk metric + regional tertentu.
    Kembalikan list nama witel, sudah diurutkan.
    """
    if metric not in _WITEL_SOURCE:
        return []

    table, witel_col, reg_col, reg_fmt = _WITEL_SOURCE[metric]

    if regional and regional.upper() != "NASIONAL":
        if reg_fmt == "numeric":
            reg_val = _to_numeric_regional(regional)
        else:
            reg_val = _to_reg_format(regional)
        safe_reg = reg_val.replace("'", "''")
        where_reg = f"AND {reg_col} = '{safe_reg}'"
    else:
        where_reg = ""

    sql = f"""
        SELECT DISTINCT {witel_col} AS witel
        FROM {table}
        WHERE {witel_col} IS NOT NULL
          AND TRIM({witel_col}) IS NOT NULL
          {where_reg}
        ORDER BY {witel_col}
    """
    try:
        df = _query(sql)
        return sorted(df["witel"].dropna().astype(str).str.strip().unique().tolist())
    except Exception as e:
        logger.warning(f"get_witels error ({metric}/{regional}): {e}")
        return []


# ── Entry point utama ─────────────────────────────────────────────────────────
def get_series(
    metric: str,
    regional: Optional[str] = None,
    witel: Optional[str] = None,
) -> pd.DataFrame:
    """
    Wrapper utama — kembalikan DataFrame [periode, regional, witel, value]
    yang siap dipakai preprocessing dan training.

    Aturan agregasi:
      regional=None, witel=None  → ambil semua baris (caller agregasi ke NASIONAL)
      regional='REG-1'           → filter 1 regional saja
      regional='REG-1', witel=X  → filter hingga witel
      witel saja tanpa regional  → filter witel di semua regional
    """
    if metric not in FETCH_REGISTRY:
        raise ValueError(f"Metric '{metric}' tidak dikenal. Pilihan: {list(FETCH_REGISTRY)}")

    fetch_fn = FETCH_REGISTRY[metric]
    df = fetch_fn(regional, witel)

    if df.empty:
        scope = f"regional={regional or 'semua'}, witel={witel or 'semua'}"
        raise ValueError(f"Tidak ada data untuk metric='{metric}', {scope}")

    df = df[["periode", "regional", "witel", "value"]].sort_values("periode")
    return df
