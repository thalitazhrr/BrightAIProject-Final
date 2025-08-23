const rules = [
  require('./target_realisasi_hsi_performance'),
  require('./hsi_segmentation_performance'),
  require('./hsi_regional_performance'),
  require('./hsi_trend_growth_analysis'),
  require('./hsi_competitive_performance')
];

module.exports = {
  database: "TARGET_ALL",
  description: "Target performance dan achievement analysis",
  total_rules: 5,
  rules: rules
};