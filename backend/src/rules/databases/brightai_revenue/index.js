const rules = [
  require('./hsi_revenue_trend_analysis'),
  require('./hsi_regional_performance_analysis'),
  require('./hsi_customer_lifecycle_analysis'),
  require('./hsi_revenue_scaling_strategy_analysis'),
  require('./hsi_gl_account_revenue_classification'),
  require('./hsi_service_hierarchy_portfolio_analysis'),
  require('./hsi_customer_behavior_pattern_analysis'),
  require('./hsi_cross_geographic_revenue_analysis')
];

module.exports = {
  database: "BRIGHTAI_REVENUE",
  description: "Revenue dan financial analysis",
  total_rules: 8,
  rules: rules
};