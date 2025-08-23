// src/rules/templates/welcomeTemplates.js
const welcomeTemplates = {
  welcome: {
    initial: "Selamat datang di BrightAI. Saya adalah asisten analisis data Telkom yang dapat membantu Anda menganalisis data dari berbagai database perusahaan.",
    
    capabilities: "Saya dapat membantu analisis data dari:",
    
    databases: [
      "PS_SCONE_ORDER: Analisis order dan sales HSI",
      "DAPROS_MIGRASI: Profil dan segmentasi customer HSI", 
      "TARGET_ALL: Analisis target dan performance",
      "MART_REV_PMS_POTS: Analisis revenue dan billing",
      "CT0_NAL_EBIS: Analisis churn dan customer lifecycle"
    ],
    
    examples: [
      "Contoh pertanyaan yang bisa Anda ajukan:",
      "- Analisis total order HSI per regional",
      "- Bagaimana performa churn divisi DBS vs RBS?",
      "- Tren revenue HSI 6 bulan terakhir",
      "- Penetrasi HSI di wilayah Jawa Barat",
      "- Analisis customer segmentation HSI"
    ],
    
    instruction: "Silakan ajukan pertanyaan analisis data yang Anda butuhkan."
  },
  
  fallback: {
    no_rule_match: "Maaf, pertanyaan Anda belum sesuai dengan rule analisis yang tersedia. Silakan coba dengan kata kunci yang lebih spesifik seperti 'analisis order HSI', 'churn analysis', 'revenue trend', dll.",
    
    general_help: "Untuk bantuan yang lebih spesifik, Anda dapat menggunakan kata kunci berikut berdasarkan jenis analisis:",
    
    help_categories: {
      sales_analysis: "Gunakan kata kunci: 'order', 'sales', 'penetrasi', 'fulfillment', 'channel performance'",
      customer_analysis: "Gunakan kata kunci: 'customer segmentation', 'profil customer', 'loyalty', 'retention'",
      performance_analysis: "Gunakan kata kunci: 'target', 'realisasi', 'performance', 'achievement'",
      revenue_analysis: "Gunakan kata kunci: 'revenue', 'billing', 'gl account', 'lifecycle'",
      churn_analysis: "Gunakan kata kunci: 'churn', 'ct0', 'divisi', 'regional churn'"
    },
    
    clarification: "Jika masih membutuhkan bantuan, coba jelaskan lebih detail data apa yang ingin Anda analisis."
  },
  
  error: {
    database_error: "Terjadi kesalahan dalam mengakses database. Silakan coba lagi dalam beberapa saat.",
    processing_error: "Terjadi kesalahan dalam memproses permintaan Anda. Silakan coba dengan pertanyaan yang lebih sederhana.",
    timeout_error: "Permintaan memakan waktu terlalu lama. Silakan coba lagi atau gunakan filter yang lebih spesifik."
  }
};

function generateWelcomeMessage() {
  const welcome = welcomeTemplates.welcome;
  
  return {
    type: 'welcome',
    message: welcome.initial,
    capabilities: {
      description: welcome.capabilities,
      databases: welcome.databases
    },
    examples: welcome.examples,
    instruction: welcome.instruction,
    timestamp: new Date().toISOString()
  };
}

function generateFallbackResponse(reason = 'no_rule_match') {
  const fallback = welcomeTemplates.fallback;
  
  return {
    type: 'fallback',
    message: fallback[reason] || fallback.no_rule_match,
    help: {
      description: fallback.general_help,
      categories: fallback.help_categories
    },
    clarification: fallback.clarification,
    timestamp: new Date().toISOString()
  };
}

function generateErrorResponse(errorType = 'processing_error') {
  const error = welcomeTemplates.error;
  
  return {
    type: 'error',
    message: error[errorType] || error.processing_error,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  welcomeTemplates,
  generateWelcomeMessage,
  generateFallbackResponse,
  generateErrorResponse
};