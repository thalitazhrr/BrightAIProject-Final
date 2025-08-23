// src/middleware/validation.js - PERLU UPDATE
const { body, validationResult } = require('express-validator');

class ValidationMiddleware {
  validateChatMessage = [
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters'),
    body('userId')
      .optional()
      .isNumeric()
      .withMessage('UserId must be a number'),
    body('sessionId')
      .optional()
      .isString()
      .withMessage('SessionId must be a string'),
    this.handleValidationErrors
  ];

  validateChatHistory = [
    body('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    body('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    this.handleValidationErrors
  ];

  validateDeleteHistory = [
    body('sessionId')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('SessionId must be a non-empty string'),
    this.handleValidationErrors
  ];

  handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }
    next();
  }
}

module.exports = new ValidationMiddleware();