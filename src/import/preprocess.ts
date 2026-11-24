import { LIMITS } from '../schema/validate';

// Import pre-processing (SPEC §4.3): users paste the AI answer as-is, often wrapped in Markdown
// fences or prose. Returns the text that should be handed to the JSON parser. Pure.

const FENCE = /```[^\n`]*\r?\n([\s\S]*?)```/g;

function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function extractJsonText(input: string): string {
  const text = input.trim();
  // oversized input is passed through untouched so the validator reports the size limit
  if (text.length > LIMITS.maxTextBytes) return text;

  const blocks = Array.from(text.matchAll(FENCE), (match) => (match[1] ?? '').trim());
  if (blocks.length > 0) {
    // first block that is valid JSON; otherwise the first block, so its parse error is shown
    return blocks.find(parses) ?? blocks[0] ?? text;
  }

  if (parses(text)) return text;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const candidate = text.slice(start, end + 1);
    if (parses(candidate)) return candidate;
  }
  // still invalid: report the parse error of the original text
  return text;
}
