// src/rules/engine/responseBuilder.js
const logger      = require('../../utils/logger');
const nlgGenerator = require('./nlgGenerator');

class ResponseBuilder {
  /**
   * Build a Markdown string response from a rule execution result.
   * Returns a plain string so the chat frontend can render it directly.
   */
  async buildResponse(executionResult, rule, userInput = '') {
    try {
      if (!executionResult.success) {
        throw new Error('Execution result was not successful');
      }

      const markdown = nlgGenerator.generate(rule, executionResult, userInput);
      return markdown;

    } catch (error) {
      logger.error('Response building error:', error);
      throw new Error(`Failed to build response: ${error.message}`);
    }
  }
}

module.exports = new ResponseBuilder();
