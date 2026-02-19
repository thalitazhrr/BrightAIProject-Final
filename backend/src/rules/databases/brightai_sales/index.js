// Registrasi semua rule BRIGHTAI_SALES

const rules = [
  require('./total_order_hsi'),
  require('./order_per_struktur_geografis'),
  require('./order_per_bandwidth'),
  require('./penetrasi_hsi_wilayah'),
  require('./fulfillment_success_rate'),
  require('./installation_time_analysis'),
  require('./revenue_per_bandwidth'),
  require('./channel_performance_hsi'),
  require('./digital_product_penetration'),
  require('./seasonal_pattern_analysis'),
  require('./growth_trend_analysis')
];

module.exports = {
  database: "BRIGHTAI_SALES",
  description: "Sales dan order management analysis",
  total_rules: 11,
  rules: rules
};