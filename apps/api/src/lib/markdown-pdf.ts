import { createWriteStream } from "node:fs";
import { lexer, type Token, type Tokens } from "marked";
import PDFDocument from "pdfkit";

const PDF_MARGIN = 56;
const BODY_FONT_SIZE = 11;
const BODY_COLOR = "#111827";
const MUTED_COLOR = "#6b7280";
const BORDER_COLOR = "#d1d5db";

export function writeMarkdownPdf(markdown: string, filePath: string) {
  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      bufferPages: true,
      margins: {
        top: PDF_MARGIN,
        right: PDF_MARGIN,
        bottom: PDF_MARGIN,
        left: PDF_MARGIN,
      },
      info: {
        Title: "AI Research Report",
        Creator: "product-endpoint",
      },
    });

    const stream = createWriteStream(filePath);

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    doc.pipe(stream);
    renderMarkdownTokens(doc, lexer(markdown));
    addPageNumbers(doc);
    doc.end();
  });
}

function renderMarkdownTokens(
  doc: PDFKit.PDFDocument,
  tokens: Token[],
  indent = 0,
) {
  for (const token of tokens) {
    switch (token.type) {
      case "space":
        doc.moveDown(0.4);
        break;
      case "heading":
        renderHeading(doc, token as Tokens.Heading, indent);
        break;
      case "paragraph":
        renderParagraph(doc, inlineText(token.tokens, token.text), indent);
        break;
      case "text":
        renderParagraph(doc, inlineText(token.tokens, token.text), indent);
        break;
      case "list":
        renderList(doc, token as Tokens.List, indent);
        break;
      case "blockquote":
        renderBlockquote(doc, token as Tokens.Blockquote, indent);
        break;
      case "code":
        renderCodeBlock(doc, token as Tokens.Code, indent);
        break;
      case "hr":
        renderRule(doc, indent);
        break;
      case "table":
        renderTable(doc, token as Tokens.Table, indent);
        break;
      case "html":
        renderParagraph(doc, stripHtml(token.text), indent);
        break;
      default:
        if ("tokens" in token && Array.isArray(token.tokens)) {
          renderMarkdownTokens(doc, token.tokens, indent);
        }
        break;
    }
  }
}

function renderHeading(
  doc: PDFKit.PDFDocument,
  token: Tokens.Heading,
  indent: number,
) {
  const fontSize = headingFontSize(token.depth);
  const text = inlineText(token.tokens, token.text);
  const width = textWidth(doc, indent);
  doc.font("Helvetica-Bold").fontSize(fontSize);
  const height = doc.heightOfString(text, { width, lineGap: 2 });
  ensureSpace(doc, height + fontSize * (token.depth === 1 ? 0.7 : 0.45));
  doc
    .moveDown(token.depth === 1 ? 0.7 : 0.45)
    .font("Helvetica-Bold")
    .fontSize(fontSize)
    .fillColor(BODY_COLOR)
    .text(text, textX(doc, indent), doc.y, {
      width,
      lineGap: 2,
    });
  doc.moveDown(0.35);
}

function renderParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  indent: number,
) {
  const value = text.trim();

  if (!value) {
    return;
  }

  doc
    .font("Helvetica")
    .fontSize(BODY_FONT_SIZE)
    .fillColor(BODY_COLOR)
    .text(value, textX(doc, indent), doc.y, {
      width: textWidth(doc, indent),
      lineGap: 4,
    });
  doc.moveDown(0.65);
}

function renderList(
  doc: PDFKit.PDFDocument,
  token: Tokens.List,
  indent: number,
) {
  const startNumber = typeof token.start === "number" ? token.start : 1;

  token.items.forEach((item, index) => {
    const firstToken = item.tokens[0];
    const firstLine =
      firstToken?.type === "paragraph" || firstToken?.type === "text"
        ? inlineText(firstToken.tokens, firstToken.text)
        : (item.text.split("\n")[0] ?? "");
    const remainingTokens =
      firstToken?.type === "paragraph" || firstToken?.type === "text"
        ? item.tokens.slice(1)
        : item.tokens;
    const label = token.ordered
      ? `${startNumber + index}.`
      : item.task
        ? item.checked
          ? "[x]"
          : "[ ]"
        : "-";
    const labelWidth = 24;

    doc.font("Helvetica").fontSize(BODY_FONT_SIZE);
    const itemHeight = doc.heightOfString(firstLine.trim(), {
      width: textWidth(doc, indent + labelWidth),
      lineGap: 4,
    });
    ensureSpace(doc, itemHeight);

    const y = doc.y;
    doc
      .font("Helvetica")
      .fontSize(BODY_FONT_SIZE)
      .fillColor(BODY_COLOR)
      .text(label, textX(doc, indent), y, { width: labelWidth });

    doc
      .font("Helvetica")
      .fontSize(BODY_FONT_SIZE)
      .fillColor(BODY_COLOR)
      .text(firstLine.trim(), textX(doc, indent + labelWidth), y, {
        width: textWidth(doc, indent + labelWidth),
        lineGap: 4,
      });
    doc.moveDown(0.35);

    if (remainingTokens.length > 0) {
      renderMarkdownTokens(doc, remainingTokens, indent + labelWidth);
    }
  });

  doc.moveDown(0.35);
}

function renderBlockquote(
  doc: PDFKit.PDFDocument,
  token: Tokens.Blockquote,
  indent: number,
) {
  const quoteIndent = indent + 16;

  ensureSpace(doc, BODY_FONT_SIZE * 3);
  doc
    .save()
    .strokeColor(BORDER_COLOR)
    .lineWidth(2)
    .moveTo(textX(doc, indent), doc.y)
    .lineTo(textX(doc, indent), doc.y + BODY_FONT_SIZE * 3)
    .stroke()
    .restore();

  doc.font("Helvetica-Oblique").fillColor(MUTED_COLOR);
  renderMarkdownTokens(doc, token.tokens, quoteIndent);
  doc.fillColor(BODY_COLOR).font("Helvetica");
}

function renderCodeBlock(
  doc: PDFKit.PDFDocument,
  token: Tokens.Code,
  indent: number,
) {
  const width = textWidth(doc, indent);
  const text = token.text.trimEnd();

  doc.font("Courier").fontSize(9);
  const height = doc.heightOfString(text, { width, lineGap: 3 }) + 18;
  ensureSpace(doc, height);

  const x = textX(doc, indent);
  const y = doc.y;

  doc
    .save()
    .roundedRect(x, y, width, height, 4)
    .fillAndStroke("#f3f4f6", "#e5e7eb")
    .restore();
  doc
    .font("Courier")
    .fontSize(9)
    .fillColor(BODY_COLOR)
    .text(text, x + 9, y + 9, { width: width - 18, lineGap: 3 });
  doc.y = y + height + 8;
}

function renderRule(doc: PDFKit.PDFDocument, indent: number) {
  ensureSpace(doc, 24);
  const x = textX(doc, indent);
  doc
    .save()
    .strokeColor(BORDER_COLOR)
    .lineWidth(1)
    .moveTo(x, doc.y + 8)
    .lineTo(x + textWidth(doc, indent), doc.y + 8)
    .stroke()
    .restore();
  doc.moveDown(1.2);
}

function renderTable(
  doc: PDFKit.PDFDocument,
  token: Tokens.Table,
  indent: number,
) {
  const rows = [token.header, ...token.rows]
    .map((row) =>
      row.map((cell) => inlineText(cell.tokens, cell.text)).join(" | "),
    )
    .join("\n");

  renderCodeBlock(
    doc,
    {
      type: "code",
      raw: token.raw,
      text: rows,
    },
    indent,
  );
}

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const pageRange = doc.bufferedPageRange();

  for (
    let pageIndex = pageRange.start;
    pageIndex < pageRange.start + pageRange.count;
    pageIndex += 1
  ) {
    doc.switchToPage(pageIndex);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED_COLOR);

    const label = `Page ${pageIndex - pageRange.start + 1} of ${pageRange.count}`;
    const x =
      doc.page.margins.left +
      (contentWidth(doc) - doc.widthOfString(label)) / 2;

    // The footer sits below content's usable maxY (in the bottom margin), so
    // passing `width`/wrapping here would make PDFKit's LineWrapper think the
    // text overflows the page and auto-insert a blank trailing page.
    // `lineBreak: false` renders it as a single line without that check.
    doc.text(label, x, doc.page.height - 42, {
      lineBreak: false,
    });
  }
}

function inlineText(tokens: Token[] | undefined, fallback: string) {
  if (!tokens || tokens.length === 0) {
    return fallback;
  }

  return tokens.map(inlineTokenText).join("");
}

function inlineTokenText(token: Token): string {
  switch (token.type) {
    case "br":
      return "\n";
    case "codespan":
      return token.text;
    case "em":
    case "strong":
    case "del":
      return inlineText(token.tokens, token.text);
    case "escape":
    case "text":
      return inlineText(
        "tokens" in token ? token.tokens : undefined,
        token.text,
      );
    case "link": {
      const text = inlineText(token.tokens, token.text);
      return text === token.href ? text : `${text} (${token.href})`;
    }
    case "image":
      return token.text ? `[image: ${token.text}]` : "[image]";
    case "html":
      return stripHtml(token.text);
    default:
      if ("tokens" in token && Array.isArray(token.tokens)) {
        return inlineText(token.tokens, token.raw);
      }

      return "text" in token && typeof token.text === "string"
        ? token.text
        : token.raw;
  }
}

function stripHtml(value: string) {
  return value.replaceAll(/<[^>]*>/g, "").trim();
}

function headingFontSize(depth: number) {
  if (depth === 1) {
    return 22;
  }

  if (depth === 2) {
    return 17;
  }

  if (depth === 3) {
    return 14;
  }

  return 12;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function textX(doc: PDFKit.PDFDocument, indent: number) {
  return doc.page.margins.left + indent;
}

function textWidth(doc: PDFKit.PDFDocument, indent: number) {
  return contentWidth(doc) - indent;
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}
