export function filterSelectionForDiff(selection: Selection, showDiff: boolean, isReverted: boolean): string {
  let selectedText = selection.toString().trim()

  // In diff mode, exclude deleted words from selection
  if (showDiff && !isReverted) {
    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer

    // Get all deleted spans within the selection
    let parentElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as HTMLElement)

    // Traverse up to find the segment div
    while (parentElement && !parentElement.hasAttribute("data-segment-id")) {
      parentElement = parentElement.parentElement
    }

    if (parentElement) {
      // Get all text nodes except those inside deleted spans
      const walker = document.createTreeWalker(range.cloneContents(), NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement
          // Reject if parent is a deleted span (has line-through class)
          if (parent?.classList.contains("line-through")) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        },
      })

      const validTextParts: string[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim()
        if (text) validTextParts.push(text)
      }

      selectedText = validTextParts.join(" ")
    }
  }

  return selectedText.replace(/\s+/g, " ").trim()
}
