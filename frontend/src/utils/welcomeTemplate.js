// src/utils/welcomeTemplate.js
// Mirrors backend/src/rules/template/welcomeTemplates.js — single source of truth for welcome content

const welcomeTemplates = {
  welcome: {
    initial: 'Selamat datang di BrightAI! Saya adalah asisten analisis data Telkom yang dapat membantu Anda menganalisis data dari berbagai database perusahaan.',

    capabilities: 'Saya dapat membantu analisis data dari:',

    databases: [
      'BRIGHTAI_SALES: Analisis order dan sales HSI',
      'BRIGHTAI_DAPROS: Profil dan segmentasi customer HSI',
      'BRIGHTAI_TARGET: Analisis target dan performance',
      'BRIGHTAI_REVENUE: Analisis revenue dan billing',
      'BRIGHTAI_CT0_NAL: Analisis churn dan customer lifecycle',
    ],

    examples: [
      'Contoh pertanyaan yang bisa Anda ajukan:',
      'Analisis total order HSI per regional',
      'Bagaimana performa churn divisi DBS vs RBS?',
      'Tren revenue HSI 6 bulan terakhir',
      'Penetrasi HSI di wilayah Jawa Barat',
      'Analisis customer segmentation HSI',
    ],

    instruction: 'Silakan ajukan pertanyaan analisis data yang Anda butuhkan!',
  },
};

export function generateWelcomeMessage() {
  const { initial, capabilities, databases, examples, instruction } = welcomeTemplates.welcome;

  // Use "- " prefix so markdownParser detects each item as a list entry (renders with • bullet)
  const dbList = databases.map(db => `- ${db}`).join('\n');
  const exampleList = examples.slice(1).map(ex => `- ${ex}`).join('\n');

  return `**${initial}**\n\n**${capabilities}**\n\n${dbList}\n\n**${examples[0]}**\n${exampleList}\n\n${instruction}`;
}

export default welcomeTemplates;
