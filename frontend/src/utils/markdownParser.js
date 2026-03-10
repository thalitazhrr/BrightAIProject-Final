// Markdown Parser - Convert markdown text to HTML/JSX elements
import React from 'react';

export const parseMarkdownToJSX = (text, theme = 'dark') => {
  // Handle non-string inputs
  if (!text) return null;
  
  // Convert to string if it's not already a string
  let textString;
  if (typeof text === 'string') {
    textString = text;
  } else if (typeof text === 'object') {
    // Handle objects by converting to JSON string
    try {
      textString = JSON.stringify(text, null, 2);
    } catch (e) {
      textString = '[Complex Object - Cannot Display]';
    }
  } else {
    textString = String(text);
  }

  // Split text into lines for processing
  const lines = textString.split('\n');
  const elements = [];
  let currentParagraph = [];
  let listItems = [];
  let isInList = false;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const paragraph = currentParagraph.join(' ').trim();
      if (paragraph) {
        elements.push(
          <p 
            key={elements.length} 
            className={`mb-3 leading-relaxed ${
              theme === 'dark' ? 'text-slate-200' : 'text-gray-800'
            }`}
          >
            {parseInlineMarkdown(paragraph, theme)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul 
          key={elements.length} 
          className={`mb-4 ml-4 space-y-1 ${
            theme === 'dark' ? 'text-slate-200' : 'text-gray-800'
          }`}
        >
          {listItems.map((item, index) => (
            <li key={index}>
              <span className={`mr-1 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`}>•</span>
              <span>{parseInlineMarkdown(item, theme)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
      isInList = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Empty line
    if (!trimmedLine) {
      if (isInList) {
        flushList();
      } else {
        flushParagraph();
      }
      return;
    }

    // Headers (##, ###)
    if (trimmedLine.startsWith('###')) {
      flushParagraph();
      flushList();
      const headerText = trimmedLine.replace(/^###\s*/, '');
      elements.push(
        <h3 
          key={elements.length} 
          className={`text-lg font-semibold mb-3 mt-4 ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`}
        >
          {parseInlineMarkdown(headerText, theme)}
        </h3>
      );
      return;
    }

    if (trimmedLine.startsWith('##')) {
      flushParagraph();
      flushList();
      const headerText = trimmedLine.replace(/^##\s*/, '');
      elements.push(
        <h2 
          key={elements.length} 
          className={`text-xl font-bold mb-3 mt-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          {parseInlineMarkdown(headerText, theme)}
        </h2>
      );
      return;
    }

    // List items
    if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || /^\d+\./.test(trimmedLine)) {
      flushParagraph();
      isInList = true;
      const listItemText = trimmedLine.replace(/^[•\-]?\s*(\d+\.)?\s*/, '');
      listItems.push(listItemText);
      return;
    }

    // Code blocks (```text```)
    if (trimmedLine.startsWith('```')) {
      flushParagraph();
      flushList();
      // Simple code block handling - would need more complex logic for multi-line
      return;
    }

    // Horizontal rule
    if (trimmedLine.match(/^[\-\*\_]{3,}$/)) {
      flushParagraph();
      flushList();
      elements.push(
        <hr 
          key={elements.length} 
          className={`my-4 border-t ${
            theme === 'dark' ? 'border-slate-600' : 'border-gray-300'
          }`} 
        />
      );
      return;
    }

    // Regular paragraph text
    if (isInList) {
      flushList();
    }
    currentParagraph.push(trimmedLine);
  });

  // Flush remaining content
  flushParagraph();
  flushList();

  return <div className="space-y-2">{elements}</div>;
};

export const parseInlineMarkdown = (text, theme = 'dark') => {
  // Handle non-string inputs
  if (!text) return null;
  
  // Convert to string if it's not already a string
  let textString;
  if (typeof text === 'string') {
    textString = text;
  } else if (typeof text === 'object') {
    try {
      textString = JSON.stringify(text, null, 2);
    } catch (e) {
      textString = '[Complex Object - Cannot Display]';
    }
  } else {
    textString = String(text);
  }

  // Convert text to array of elements
  let result = [textString];

  // Bold text (**text**)
  result = result.flatMap(item => {
    if (typeof item !== 'string') return item;
    const parts = item.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return (
          <strong 
            key={`bold-${index}`} 
            className={`font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            {boldText}
          </strong>
        );
      }
      return part;
    });
  });

  // Italic text (*text*)
  result = result.flatMap(item => {
    if (typeof item !== 'string') return item;
    const parts = item.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        const italicText = part.slice(1, -1);
        return (
          <em 
            key={`italic-${index}`} 
            className={`italic ${
              theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
            }`}
          >
            {italicText}
          </em>
        );
      }
      return part;
    });
  });

  // Inline code (`code`)
  result = result.flatMap(item => {
    if (typeof item !== 'string') return item;
    const parts = item.split(/(`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        const codeText = part.slice(1, -1);
        return (
          <code 
            key={`code-${index}`} 
            className={`px-1 py-0.5 rounded text-sm font-mono ${
              theme === 'dark' 
                ? 'bg-slate-700 text-green-400' 
                : 'bg-gray-200 text-green-700'
            }`}
          >
            {codeText}
          </code>
        );
      }
      return part;
    });
  });

  // Numbers and percentages
  result = result.flatMap(item => {
    if (typeof item !== 'string') return item;
    // Match numbers with commas, percentages, and currency
    const parts = item.split(/(\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|\d+\.\d+%?|\b\d+%?\b)/g);
    return parts.map((part, index) => {
      if (/^\d/.test(part) && (part.includes(',') || part.includes('%') || part.includes('.'))) {
        return (
          <span 
            key={`number-${index}`} 
            className={`font-semibold ${
              theme === 'dark' ? 'text-yellow-400' : 'text-orange-600'
            }`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  });

  // Emojis and special characters
  result = result.flatMap(item => {
    if (typeof item !== 'string') return item;
    const parts = item.split(/(📊|🤖|🗺️|📦|⚙️|🎯|🔧|📈|✅|⚠️|❌|🚀|💡|🔍|🎉)/g);
    return parts.map((part, index) => {
      if (/^[📊🤖🗺️📦⚙️🎯🔧📈✅⚠️❌🚀💡🔍🎉]$/.test(part)) {
        return (
          <span 
            key={`emoji-${index}`} 
            className="text-lg mr-1"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  });

  // Filter out any invalid React elements and ensure we return valid content
  return result.filter(item => {
    // Keep strings and valid React elements
    if (typeof item === 'string') return item.length > 0;
    if (React.isValidElement(item)) return true;
    return false;
  });
};

// Simple markdown to plain text converter
export const markdownToPlainText = (text) => {
  if (!text) return '';
  
  // Convert to string if it's not already a string
  let textString;
  if (typeof text === 'string') {
    textString = text;
  } else if (typeof text === 'object') {
    try {
      textString = JSON.stringify(text, null, 2);
    } catch (e) {
      textString = '[Complex Object - Cannot Display]';
    }
  } else {
    textString = String(text);
  }
  
  return textString
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1')     // Remove italic
    .replace(/`([^`]+)`/g, '$1')       // Remove inline code
    .replace(/#{1,6}\s*/g, '')         // Remove headers
    .replace(/^\s*[•\-\*]\s*/gm, '')   // Remove list bullets
    .replace(/^\s*\d+\.\s*/gm, '')     // Remove numbered lists
    .trim();
};

export default {
  parseMarkdownToJSX,
  parseInlineMarkdown,
  markdownToPlainText
};