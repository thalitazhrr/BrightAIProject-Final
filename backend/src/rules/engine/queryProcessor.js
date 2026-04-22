// src/rules/engine/queryProcessor.js
const logger = require('../../utils/logger');

class QueryProcessor {
  async findMatchingRule(userInput, rulesMap) {
    try {
      const rules = Array.from(rulesMap.values());
      const matches = [];
      
      for (const rule of rules) {
        try {
          if (rule.PATTERN_MATCHING && rule.PATTERN_MATCHING.checkMatch) {
            const matchResult = rule.PATTERN_MATCHING.checkMatch(userInput);
            
            if (matchResult.matches && matchResult.confidence >= 70) {
              matches.push({
                rule: rule,
                confidence: matchResult.confidence,
                focus_area: matchResult.focus_area
              });
            }
          }
        } catch (error) {
          logger.error(`Error checking rule ${rule.RULE_META.RULE_ID}:`, error);
        }
      }
      
      if (matches.length === 0) {
        return {
          success: false,
          reason: 'no_matching_rule',
          message: 'Tidak ditemukan rule yang sesuai dengan pertanyaan Anda'
        };
      }
      
      matches.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = matches[0];
      
      logger.info(`Rule matched: ${bestMatch.rule.RULE_META.RULE_NAME} with confidence ${bestMatch.confidence}%`);
      
      return {
        success: true,
        rule: bestMatch.rule,
        confidence: bestMatch.confidence,
        focus_area: bestMatch.focus_area,
        alternatives: matches.slice(1, 3)
      };
      
    } catch (error) {
      logger.error('Query processing error:', error);
      return {
        success: false,
        reason: 'processing_error',
        message: 'Terjadi kesalahan dalam memproses query'
      };
    }
  }

  isWelcomeQuery(userInput) {
    const welcomeKeywords = [
      'hai', 'hello', 'hi', 'selamat', 'halo', 'apa kabar',
      'welcome', 'bantuan', 'help', 'mulai', 'start'
    ];

    const lowerInput = userInput.toLowerCase().trim();
    return welcomeKeywords.some(keyword => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i').test(lowerInput);
    }) || lowerInput.length < 10;
  }

  isHelpQuery(userInput) {
    const helpKeywords = [
      'bantuan', 'help', 'bisa apa', 'fitur', 'kemampuan',
      'cara', 'how to', 'panduan', 'petunjuk'
    ];

    const lowerInput = userInput.toLowerCase();
    return helpKeywords.some(keyword => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i').test(lowerInput);
    });
  }
}

module.exports = new QueryProcessor();
