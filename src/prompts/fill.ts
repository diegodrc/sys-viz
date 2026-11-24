/**
 * Replaces every `{{NAME}}` placeholder literally (split/join, so `$&`-style sequences in the
 * values are never interpreted as regex replacement patterns).
 */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  let out = template;
  for (const [name, value] of Object.entries(values)) {
    out = out.split(`{{${name}}}`).join(value);
  }
  return out;
}
