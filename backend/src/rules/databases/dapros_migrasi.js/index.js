// Registrasi semua rule DAPROS_MIGRASI

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
  database: "DAPROS_MIGRASI",
  description: "Customer profiling dan segmentation analysis",
  total_rules: 7,
  rules: rules,
  
  // Special handling untuk dynamic table name
  getTableName: function() {
    // Logic untuk mendapatkan tabel DAPROS_MIGRASI_YYYYMM terbaru
    return "DAPROS_MIGRASI_" + new Date().toISOString().slice(0,7).replace('-','');
  }
};