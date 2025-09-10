// Markdown記法からBacklog記法に変換する関数群

// 定数定義
const REGEX_PATTERNS = {
  HEADING: /^#+\s+/,
  HEADING_CHECK: /^\*+\s/,
  TAB_LIST: /^\t+-/,
  SPACE_LIST: /^ +-/,
  NUMBERED_LIST: /^\d+\.\s+/,
  BOLD: /\*\*(.+?)\*\*/g,
  ITALIC: /\*(.+?)\*/g,
  STRIKETHROUGH: /~~(.+?)~~/g,
  CODE_BLOCK_START: /^```(\w+)/,
  CODE_BLOCK_END: /^```\s*$/,
  QUOTE_START: /^>\s?/,
  TABLE_SEPARATOR: /^\s*\|(\s*-+\s*\|)+\s*$/,
  TABLE_ROW: /^\s*\|.*\|\s*$/,
  LINK: /\[(.+?)\]\((.+?)\)/g,
  URL: /(^|[^>])(https?:\/\/[^\s\[\]]+)/g,
  BR_TAG: /<br>/g,
  CR: /\r$/
} as const;

const BACKLOG_SYNTAX = {
  CODE_BLOCK: {
    START: '{code}',
    END: '{/code}'
  },
  QUOTE: {
    START: '{quote}',
    END: '{/quote}'
  },
  FORMATTING: {
    BOLD: "''",
    ITALIC: "'''",
    STRIKETHROUGH: '%%'
  },
  LINK: {
    START: '[[',
    END: ']]',
    SEPARATOR: '>'
  },
  LIST: {
    DASH: '-',
    PLUS: '+'
  },
  HTML: {
    BR: '&br;'
  }
} as const;

const DEFAULT_VALUES = {
  INDENT_SIZE: 2
} as const;

// 見出しの変換: # 見出し → * 見出し
function convertHeading(line: string): string {
  if (REGEX_PATTERNS.HEADING.test(line)) {
    return line.replace(/^(#+)\s+(.+)$/, (_, hashes, text) => {
      return '*'.repeat(hashes.length) + ' ' + text;
    });
  }
  return line;
}

// 見出し前後の空行を削除する関数
function removeEmptyLinesAroundHeadings(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 現在の行が見出し行の場合
    if (REGEX_PATTERNS.HEADING_CHECK.test(line)) {
      // 前の空行を削除
      while (result.length > 0 && result[result.length - 1] === '') {
        result.pop();
      }
      
      result.push(line);
      
      // 次の空行をスキップ
      if (i + 1 < lines.length && lines[i + 1] === '') {
        i++; // 空行をスキップ
      }
    } else {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

// 太字の変換: **太字** → ''太字''
function convertBold(text: string): string {
  return text.replace(REGEX_PATTERNS.BOLD, `${BACKLOG_SYNTAX.FORMATTING.BOLD}$1${BACKLOG_SYNTAX.FORMATTING.BOLD}`);
}

// 斜体の変換: *斜体* → '''斜体'''
function convertItalic(text: string): string {
  return text.replace(REGEX_PATTERNS.ITALIC, `${BACKLOG_SYNTAX.FORMATTING.ITALIC}$1${BACKLOG_SYNTAX.FORMATTING.ITALIC}`);
}

// 打ち消し線の変換: ~~打ち消し線~~ → %%打ち消し線%%
function convertStrikethrough(text: string): string {
  return text.replace(REGEX_PATTERNS.STRIKETHROUGH, `${BACKLOG_SYNTAX.FORMATTING.STRIKETHROUGH}$1${BACKLOG_SYNTAX.FORMATTING.STRIKETHROUGH}`);
}

// テキスト装飾をまとめて適用するヘルパー関数
function applyTextDecorations(text: string): string {
  let result = text;
  result = convertBold(result);
  result = convertItalic(result);
  result = convertStrikethrough(result);
  return result;
}

// 引用内容を処理するヘルパー関数
function processQuoteContent(content: string, indentSize: number): string {
  let result = content;
  // 引用内でネストリスト変換を適用
  result = convertNestedList(result, indentSize);
  // 引用内でもテキスト装飾を適用
  result = applyTextDecorations(result);
  return result;
}

// ネストリストの変換: インデント指定スペース → -, 指定スペース×2 → --, タブ1つ → -, タブ2つ → --など
function convertNestedList(line: string, indentSize: number = DEFAULT_VALUES.INDENT_SIZE): string {
  // タブによるインデント
  if (REGEX_PATTERNS.TAB_LIST.test(line)) {
    return line.replace(/^(\t+)-\s(.+)$/, (_, tabs, text) => {
      const indentLevel = tabs.length;
      return BACKLOG_SYNTAX.LIST.DASH.repeat(indentLevel + 1) + ' ' + text;
    });
  }
  // スペースによるインデント
  if (REGEX_PATTERNS.SPACE_LIST.test(line)) {
    return line.replace(/^( +)-\s(.+)$/, (_, spaces, text) => {
      const indentLevel = Math.floor(spaces.length / indentSize);
      return BACKLOG_SYNTAX.LIST.DASH.repeat(indentLevel + 1) + ' ' + text;
    });
  }
  return line;
}

// 番号付きリストの変換: 1. 項目 → + 項目
function convertNumberedList(line: string): string {
  if (REGEX_PATTERNS.NUMBERED_LIST.test(line)) {
    return line.replace(/^\d+\.\s+(.+)$/, `${BACKLOG_SYNTAX.LIST.PLUS} $1`);
  }
  return line;
}

// リンクの変換: [リンク](URL) → [[リンク>URL]], URL → [[URL]]
function convertLink(text: string): string {
  // 1. [テキスト](URL) → [[テキスト>URL]] （括弧内のURLを直接使用）
  let result = text.replace(REGEX_PATTERNS.LINK, `${BACKLOG_SYNTAX.LINK.START}$1${BACKLOG_SYNTAX.LINK.SEPARATOR}$2${BACKLOG_SYNTAX.LINK.END}`);
  
  // 2. URL単体 → [[URL]] （ただし、すでに[[ ]]で囲まれたものは除外）
  result = result.replace(REGEX_PATTERNS.URL, (_, prefix, url) => {
    return prefix + `${BACKLOG_SYNTAX.LINK.START}${url}${BACKLOG_SYNTAX.LINK.END}`;
  });
  
  return result;
}

// インラインコードの変換: `コード` → そのまま（無視）
function convertInlineCode(text: string): string {
  // インラインコードはそのまま残す（変換しない）
  return text;
}

// HTMLタグの変換: <br> → &br;
function convertHtmlTags(text: string): string {
  return text.replace(REGEX_PATTERNS.BR_TAG, BACKLOG_SYNTAX.HTML.BR);
}

// コードブロックの変換を行うためのヘルパー関数
function convertCodeBlocks(text: string): string {
  let result = text;
  let isInCodeBlock = false;
  
  const lines = result.split('\n');
  const processedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (REGEX_PATTERNS.CODE_BLOCK_START.test(line) && !isInCodeBlock) {
      // 言語指定ありの開始タグ
      isInCodeBlock = true;
      const matchResult = line.match(REGEX_PATTERNS.CODE_BLOCK_START);
      processedLines.push(BACKLOG_SYNTAX.CODE_BLOCK.START);
      processedLines.push(matchResult![1]);
    } else if (REGEX_PATTERNS.CODE_BLOCK_END.test(line)) {
      if (isInCodeBlock) {
        // 終了タグ
        isInCodeBlock = false;
        processedLines.push(BACKLOG_SYNTAX.CODE_BLOCK.END);
      } else {
        // 言語指定なしの開始タグ
        isInCodeBlock = true;
        processedLines.push(BACKLOG_SYNTAX.CODE_BLOCK.START);
      }
    } else {
      // 通常の行
      processedLines.push(line);
    }
  }
  
  return processedLines.join('\n');
}

// 引用の変換を行うためのヘルパー関数
function convertQuotes(text: string, indentSize: number = DEFAULT_VALUES.INDENT_SIZE): string {
  const lines = text.split('\n');
  const processedLines: string[] = [];
  let isInQuote = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 引用行の開始
    if (REGEX_PATTERNS.QUOTE_START.test(line) && !isInQuote) {
      isInQuote = true;
      processedLines.push(BACKLOG_SYNTAX.QUOTE.START);
      const quotedContent = line.replace(REGEX_PATTERNS.QUOTE_START, "");
      processedLines.push(processQuoteContent(quotedContent, indentSize));
    }
    // 引用行の継続
    else if (REGEX_PATTERNS.QUOTE_START.test(line) && isInQuote) {
      const quotedContent = line.replace(REGEX_PATTERNS.QUOTE_START, "");
      processedLines.push(processQuoteContent(quotedContent, indentSize));
    }
    // 引用の終了
    else if (isInQuote) {
      isInQuote = false;
      processedLines.push(BACKLOG_SYNTAX.QUOTE.END);
      processedLines.push(line);
    }
    // 通常の行
    else {
      processedLines.push(line);
    }
  }
  
  // ファイル終端で引用が終わっていない場合
  if (isInQuote) {
    processedLines.push(BACKLOG_SYNTAX.QUOTE.END);
  }
  
  return processedLines.join('\n');
}

// テーブルの変換を行うためのヘルパー関数
function convertTables(text: string): string {
  const lines = text.split('\n');
  const processedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // テーブル区切り行をスキップ（| --- | --- | の形式）
    if (REGEX_PATTERNS.TABLE_SEPARATOR.test(line)) {
      continue;
    }
    
    // テーブルヘッダー行（次の行が区切り行の場合）
    if (REGEX_PATTERNS.TABLE_ROW.test(line) && 
        i + 1 < lines.length && 
        REGEX_PATTERNS.TABLE_SEPARATOR.test(lines[i + 1])) {
      // 最後の |h を追加（スペースを正規化）
      const headerLine = line.replace(/\s*\|\s*$/, ' |h');
      processedLines.push(headerLine);
    }
    // 通常の行
    else {
      processedLines.push(line);
    }
  }
  
  return processedLines.join('\n');
}

// テキスト装飾の変換（コードブロック内は除外）
function convertTextDecorations(text: string): string {
  const lines = text.split('\n');
  const processedLines: string[] = [];
  let isInCodeBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // コードブロック状態の追跡
    if (line === BACKLOG_SYNTAX.CODE_BLOCK.START) {
      isInCodeBlock = true;
      processedLines.push(line);
      continue;
    } else if (line === BACKLOG_SYNTAX.CODE_BLOCK.END) {
      isInCodeBlock = false;
      processedLines.push(line);
      continue;
    }
    
    // コードブロック内では変換しない
    if (isInCodeBlock) {
      processedLines.push(line);
    } else {
      // 見出し行（*から始まる行）では変換しない
      if (REGEX_PATTERNS.HEADING_CHECK.test(line)) {
        processedLines.push(line);
      } else {
        // テキスト装飾の変換を適用
        line = applyTextDecorations(line);
        processedLines.push(line);
      }
    }
  }
  
  return processedLines.join('\n');
}

export function md2backlog(markdown: string, indentSize: number = DEFAULT_VALUES.INDENT_SIZE): string {
  let result = markdown;
  
  // 1. コードブロックの変換を最初に実行（コードブロック内の変換を防ぐため）
  result = convertCodeBlocks(result);
  
  // 2. 引用の変換（行をまたぐため全体で処理）
  result = convertQuotes(result, indentSize);
  
  // 3. テーブルの変換（行をまたぐため全体で処理）
  result = convertTables(result);
  
  // 4. 行ごとの処理（見出し、リストなど、ただしコードブロック内は除外）
  const lines = result.split('\n');
  let isInCodeBlock = false;
  const processedLines = lines.map(line => {
    // CRを除去してLFに統一
    const cleanLine = line.replace(REGEX_PATTERNS.CR, '');
    
    // コードブロック状態の追跡
    if (cleanLine === BACKLOG_SYNTAX.CODE_BLOCK.START) {
      isInCodeBlock = true;
      return cleanLine;
    } else if (cleanLine === BACKLOG_SYNTAX.CODE_BLOCK.END) {
      isInCodeBlock = false;
      return cleanLine;
    }
    
    // コードブロック内では変換しない
    if (isInCodeBlock) {
      return cleanLine;
    }
    
    // 各変換ルールを順次適用
    let processedLine = cleanLine;
    processedLine = convertHeading(processedLine);
    processedLine = convertNestedList(processedLine, indentSize);
    processedLine = convertNumberedList(processedLine);
    
    return processedLine;
  });
  
  result = processedLines.join('\n');
  
  // 5. テキスト装飾の変換（コードブロック内は除外）
  result = convertTextDecorations(result);
  
  // 6. リンクの変換（URL変換も含む）
  result = convertLink(result);
  
  // 7. HTMLタグの変換
  result = convertHtmlTags(result);
  
  // 8. 見出し前後の空行を削除
  result = removeEmptyLinesAroundHeadings(result);
  
  return result;
}