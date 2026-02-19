const rules = [
  require('./churn_rate_regional_analysis'),
  require('./ct0_pattern_masa_layanan_analysis'),
  require('./bandwidth_churn_pattern_analysis'),
  require('./witel_churn_performance_analysis'),
  require('./monthly_quarterly_churn_pattern_analysis'),
  require('./divisi_churn_comparison_analysis')
];

module.exports = {
  database: "BRIGHTAI_CT0_NAL",
  description: "Customer churn dan lifecycle analysis", 
  total_rules: 6,
  rules: rules
};