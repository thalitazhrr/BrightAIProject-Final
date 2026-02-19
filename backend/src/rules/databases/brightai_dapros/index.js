// Registrasi semua rule BRIGHTAI_DAPROS

const rules = [
  require('./hsi_customer_segmentation'),
  require('./hsi_service_bundle_analysis'),
  require('./hsi_digital_transformation_profile'),
  require('./hsi_revenue_profile_analysis'),
  require('./hsi_geographic_distribution_profile'),
  require('./hsi_speed_distribution_analysis'),
  require('./hsi_customer_loyalty_analysis')
];

module.exports = {
  database: "BRIGHTAI_DAPROS",
  description: "Customer profiling dan segmentation analysis",
  total_rules: 7,
  rules: rules,
  
  // Direct table access - USR_RPT.BRIGHTAI_DAPROS is now always up-to-date
  getTableName: function() {
    return "USR_RPT.BRIGHTAI_DAPROS";
  }
};
