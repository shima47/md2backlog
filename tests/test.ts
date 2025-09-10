import { md2backlog } from '../md2backlog';
import { readFileSync } from 'fs';
import * as diff from 'diff';

// テストデータを読み込み
const markdownInput = readFileSync('./tests/test_markdown_text.md', 'utf8');
const expectedOutput = readFileSync('./tests/test_backlog_text.txt', 'utf8');

// 変換実行
const result = md2backlog(markdownInput);

// 改行コードを正規化（CRLF -> LF）
const normalizedExpected = expectedOutput.replace(/\r\n/g, '\n');
const normalizedResult = result;

console.log("\n=== 期待値との比較 ===");
console.log("Match:", normalizedResult === normalizedExpected);

// Git風差分表示
if (normalizedResult !== normalizedExpected) {
  console.log("\n=== Git風差分表示 ===");
  const patch = diff.createTwoFilesPatch('expected.txt', 'result.txt', normalizedExpected, normalizedResult);
  console.log(patch);
} else {
  console.log("\n=== 差分なし ===");
  console.log("期待値と結果が一致しています");
}