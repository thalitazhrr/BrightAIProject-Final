// Markdown Parser - Convert markdown text to HTML/JSX elements
import React from 'react';

export const parseMarkdownToJSX = (text, theme = 'dark') => {
  if (!text) return null;

  let textString;
  if (typeof text === 'string') {
    textString = text;
  } else if (typeof text === 'object') {
    try { textString = JSON.stringify(text, null, 2); }
    catch (e) { textString = '[Complex Object - Cannot Display]'; }
  } else {
    textString = String(text);
  }

  const lines = textString.split('\n');
  const elements = [];
  let currentParagraph = [];
  let listItems = [];
  let tableLines = [];
  let isInList = false;
  let isInTable = false;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const paragraph = currentParagraph.join(' ').trim();
      if (paragraph) {
        elements.push(
          <p key={elements.length} className={`mb-3 leading-relaxed ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
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
        <ul key={elements.length} className={`mb-4 ml-4 space-y-1 ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
          {listItems.map((item, index) => (
            <li key={index}>
              <span className={`mr-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>•</span>
              <span>{parseInlineMarkdown(item, theme)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
      isInList = false;
    }
  };

  const parseRow = (line) =>
    line.split('|').slice(1, -1).map(cell => cell.trim());

  const isSeparatorRow = (line) => /^\|[\s\-|:]+\|$/.test(line.trim());

  const flushTable = () => {
    if (tableLines.length === 0) return;

    const sepIdx = tableLines.findIndex(l => isSeparatorRow(l));
    let headers = [];
    let rows = [];

    if (sepIdx === 1) {
      headers = parseRow(tableLines[0]);
      rows = tableLines.slice(2).map(parseRow);
    } else {
      rows = tableLines.filter(l => !isSeparatorRow(l)).map(parseRow);
    }

    elements.push(
      <div key={elements.length} className="overflow-x-auto my-3">
        <table className={`w-full text-sm border-collapse rounded-lg overflow-hidden ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
          {headers.length > 0 && (
            <thead>
              <tr className={theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}>
                {headers.map((h, i) => (
                  <th key={i} className={`px-3 py-2 text-left font-semibold border ${theme === 'dark' ? 'border-slate-600 text-white' : 'border-gray-300 text-gray-900'}`}>
                    {parseInlineMarkdown(h, theme)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={
                ri % 2 === 0
                  ? (theme === 'dark' ? 'bg-slate-800/50' : 'bg-white')
                  : (theme === 'dark' ? 'bg-slate-700/30' : 'bg-gray-50')
              }>
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 border ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
                    {parseInlineMarkdown(cell, theme)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    tableLines = [];
    isInTable = false;
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    // Table row detection
    if (trimmedLine.startsWith('|')) {
      if (!isInTable) {
        flushParagraph();
        flushList();
        isInTable = true;
      }
      tableLines.push(trimmedLine);
      return;
    }

    // Leaving table
    if (isInTable) {
      flushTable();
    }

    // Empty line
    if (!trimmedLine) {
      if (isInList) flushList();
      else flushParagraph();
      return;
    }

    // Headers
    if (trimmedLine.startsWith('###')) {
      flushParagraph(); flushList();
      const headerText = trimmedLine.replace(/^###\s*/, '');
      elements.push(
        <h3 key={elements.length} className={`text-lg font-semibold mb-3 mt-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
          {parseInlineMarkdown(headerText, theme)}
        </h3>
      );
      return;
    }

    if (trimmedLine.startsWith('##')) {
      flushParagraph(); flushList();
      const headerText = trimmedLine.replace(/^##\s*/, '');
      elements.push(
        <h2 key={elements.length} className={`text-xl font-bold mb-3 mt-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {parseInlineMarkdown(headerText, theme)}
        </h2>
      );
      return;
    }

    // Horizontal rule — before list check (--- starts with -)
    if (trimmedLine.match(/^[\-\*\_]{3,}$/)) {
      flushParagraph(); flushList();
      elements.push(
        <hr key={elements.length} className={`my-3 border-t ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`} />
      );
      return;
    }

    // Footer line: _text_ on its own → small muted text
    if (trimmedLine.startsWith('_') && trimmedLine.endsWith('_') && trimmedLine.length > 2) {
      flushParagraph(); flushList();
      const footerText = trimmedLine.slice(1, -1);
      elements.push(
        <p key={elements.length} className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
          {parseInlineMarkdown(footerText, theme)}
        </p>
      );
      return;
    }

    // List items (- item, not ---)
    if (trimmedLine.startsWith('•') || /^-\s/.test(trimmedLine) || /^\d+\./.test(trimmedLine)) {
      flushParagraph();
      isInList = true;
      const listItemText = trimmedLine.replace(/^[•\-]?\s*(\d+\.)?\s*/, '');
      listItems.push(listItemText);
      return;
    }

    // Code blocks
    if (trimmedLine.startsWith('```')) {
      flushParagraph(); flushList();
      return;
    }

    // Regular paragraph
    if (isInList) flushList();
    currentParagraph.push(trimmedLine);
  });

  // Flush remaining
  flushTable();
  flushParagraph();
  flushList();

  return <div className="space-y-2">{elements}</div>;
};

export const parseInlineMarkdown = (text, theme = 'dark') => {
  if (!text) return null;

  let textString;
  if (typeof text === 'string') {
    textString = text;
  } else if (typeof text === 'object') {
    try { textString = JSON.stringify(text, null, 2); }
    catch (e) { textString = '[Complex Object - Cannot Display]'; }
  } else {
    textString = String(text);
  }

  let result = [textString];

  // Bold text (**text**)
  result = result.flatMap(item => {
    if (typeof item !== 'string') return item;
    const parts = item.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`bold-${index}`} className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  });

  // Italic text (*text* or _text_)
  result = result.flatMap(item => {
    if (typeof item !== 'string') return item;
    const parts = item.split(/(\*[^*]+\*|_[^_]+_)/g);
    return parts.map((part, index) => {
      const isItalicStar = part.startsWith('*') && part.endsWith('*') && !part.startsWith('**');
      const isItalicUnder = part.startsWith('_') && part.endsWith('_');
      if (isItalicStar || isItalicUnder) {
        return (
          <em key={`italic-${index}`} className={`italic ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
            {part.slice(1, -1)}
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
        return (
          <code key={`code-${index}`} className={`px-1 py-0.5 rounded text-sm font-mono ${theme === 'dark' ? 'bg-slate-700 text-green-400' : 'bg-gray-200 text-green-700'}`}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  });

  // Numbers: highlight only comma-formatted (1.709) or percentages (85%)
  // Fixed regex: require comma groups for large numbers, preventing split of decimals like 1090.4
  result = result.flatMap(item => {
    if (typeof item !== 'string') return item;
    const parts = item.split(/(\b\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|\b\d+(?:\.\d+)?%\b|\b\d{4,}(?:\.\d+)?\b)/g);
    return parts.map((part, index) => {
      if (/^\d/.test(part) && (part.includes(',') || part.endsWith('%') || part.length >= 4)) {
        return (
          <span key={`number-${index}`} className={`font-semibold ${theme === 'dark' ? 'text-yellow-400' : 'text-orange-600'}`}>
            {part}
          </span>
        );
      }
      return part;
    });
  });

  return result.filter(item => {
    if (typeof item === 'string') return item.length > 0;
    if (React.isValidElement(item)) return true;
    return false;
  });
};

export const markdownToPlainText = (text) => {
  if (!text) return '';
  let textString;
  if (typeof text === 'string') {
    textString = text;
  } else if (typeof text === 'object') {
    try { textString = JSON.stringify(text, null, 2); }
    catch (e) { textString = '[Complex Object - Cannot Display]'; }
  } else {
    textString = String(text);
  }
  return textString
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^\s*[•\-\*]\s*/gm, '')
    .replace(/^\s*\d+\.\s*/gm, '')
    .trim();
};

export default { parseMarkdownToJSX, parseInlineMarkdown, markdownToPlainText };
