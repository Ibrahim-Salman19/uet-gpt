export interface EvidenceForContext {
  id: string;
  title: string;
  url: string;
  authority: string;
  publishedDate?: string;
  lastVerified?: number;
  content: string;
}

export function escapeXmlContent(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildUntrustedContext(evidenceList: EvidenceForContext[]): string {
  if (evidenceList.length === 0) {
    return "<EVIDENCE_CONTEXT>\nNo retrieved evidence available.\n</EVIDENCE_CONTEXT>";
  }

  const blocks = evidenceList.map((e) => {
    const safeId = escapeXmlContent(e.id);
    const safeTitle = escapeXmlContent(e.title);
    const safeUrl = escapeXmlContent(e.url);
    const safeAuthority = escapeXmlContent(e.authority);
    const safeContent = escapeXmlContent(e.content.trim());

    return `<UNTRUSTED_SOURCE_CONTENT evidence_id="${safeId}" title="${safeTitle}" url="${safeUrl}" authority="${safeAuthority}">
${safeContent}
</UNTRUSTED_SOURCE_CONTENT>`;
  });

  return `<EVIDENCE_CONTEXT>\n${blocks.join("\n\n")}\n</EVIDENCE_CONTEXT>`;
}
