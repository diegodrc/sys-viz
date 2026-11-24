import { ExternalLink } from 'lucide-react';

interface Props {
  label: string;
  url: string;
}

/** Only http(s) URLs become links, opened safely in a new tab (SPEC §11.6). */
export function SafeLink({ label, url }: Props) {
  const text = label || url;
  if (!/^https?:\/\//i.test(url)) {
    return (
      <span>
        {text}
        {label && <span className="ml-1 text-xs text-text-muted">{url}</span>}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent underline underline-offset-2"
    >
      {text}
      <ExternalLink size={12} aria-hidden />
    </a>
  );
}
