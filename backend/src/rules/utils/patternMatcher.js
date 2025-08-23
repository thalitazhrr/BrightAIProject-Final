// Pattern matching utility functions
const patternMatcher = {
  // Calculate confidence score based on keyword matching
  calculateConfidence(userInput, keywordPatterns) {
    if (!userInput || !keywordPatterns) return 0;
    
    const input = userInput.toLowerCase();
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    // Required patterns - higher weight
    if (keywordPatterns.required) {
      Object.keys(keywordPatterns.required).forEach(category => {
        const keywords = keywordPatterns.required[category];
        const matches = keywords.filter(keyword => input.includes(keyword.toLowerCase())).length;
        const categoryScore = (matches / keywords.length) * 100;
        totalScore += categoryScore * 2; // Double weight for required
        maxPossibleScore += 200; // 100 * 2
      });
    }
    
    // Optional patterns - normal weight
    if (keywordPatterns.optional) {
      Object.keys(keywordPatterns.optional).forEach(category => {
        const keywords = keywordPatterns.optional[category];
        const matches = keywords.filter(keyword => input.includes(keyword.toLowerCase())).length;
        const categoryScore = (matches / keywords.length) * 100;
        totalScore += categoryScore;
        maxPossibleScore += 100;
      });
    }
    
    return maxPossibleScore > 0 ? Math.min(100, (totalScore / maxPossibleScore) * 100) : 0;
  },
  
  // Detect areas of interest from user input
  detectInterest(userInput, keywordPatterns) {
    if (!userInput || !keywordPatterns) return [];
    
    const input = userInput.toLowerCase();
    const interests = [];
    
    // Check all pattern categories
    const allPatterns = { 
      ...(keywordPatterns.required || {}), 
      ...(keywordPatterns.optional || {}) 
    };
    
    Object.keys(allPatterns).forEach(category => {
      const keywords = allPatterns[category];
      const matches = keywords.filter(keyword => input.includes(keyword.toLowerCase()));
      if (matches.length > 0) {
        interests.push({
          category: category,
          matched_keywords: matches,
          confidence: (matches.length / keywords.length) * 100
        });
      }
    });
    
    return interests.sort((a, b) => b.confidence - a.confidence);
  },
  
  // Check if input contains specific pattern types
  hasPattern(userInput, patternType, keywordPatterns) {
    if (!userInput || !keywordPatterns || !keywordPatterns[patternType]) return false;
    
    const input = userInput.toLowerCase();
    return keywordPatterns[patternType].some(keyword => 
      input.includes(keyword.toLowerCase())
    );
  }
};

module.exports = patternMatcher;