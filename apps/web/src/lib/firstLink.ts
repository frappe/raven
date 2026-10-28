/** A message's previewable link: the first non-empty line of its `links` (Slack behaviour). */
export const firstLink = (links?: string): string | undefined =>
    links
        ?.split("\n")
        .map((line) => line.trim())
        .find(Boolean)
