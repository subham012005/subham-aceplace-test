import { PDFDocument, StandardFonts } from 'pdf-lib';

export async function exportToPDF(content: string, filename: string) {
    const pdfDoc = await PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    // Handle both Unix and Windows line endings
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        
        if (!rawLine.trim()) {
            y -= 14;
            if (y < margin) {
                page = pdfDoc.addPage();
                y = height - margin;
            }
            continue;
        }

        let isHeader = false;
        let fontSize = 11;
        let currentFont = regularFont;
        let textToDraw = rawLine;

        if (textToDraw.startsWith('# ')) {
            fontSize = 20;
            currentFont = boldFont;
            textToDraw = textToDraw.substring(2);
            isHeader = true;
        } else if (textToDraw.startsWith('## ')) {
            fontSize = 16;
            currentFont = boldFont;
            textToDraw = textToDraw.substring(3);
            isHeader = true;
        } else if (textToDraw.startsWith('### ')) {
            fontSize = 14;
            currentFont = boldFont;
            textToDraw = textToDraw.substring(4);
            isHeader = true;
        }

        const lineHeight = fontSize * 1.5;
        let currentX = margin;

        const parts = textToDraw.split(/(\*\*.*?\*\*)/g);

        for (const part of parts) {
            if (!part) continue;
            let partText = part;
            let partFont = currentFont;
            
            if (part.startsWith('**') && part.endsWith('**')) {
                partFont = boldFont;
                partText = part.substring(2, part.length - 2);
            }

            // Split into words and spaces to preserve whitespace width
            // but we also need to allow line breaking
            const words = partText.split(/(\s+)/); 
            
            for (const word of words) {
                if (!word) continue;

                // clean up characters outside of pdf-lib standard font
                // pdf-lib Helvetica only supports WinAnsi characters
                let cleanWord = word.replace(/[^\x00-\xFF]/g, '?');

                const wordWidth = partFont.widthOfTextAtSize(cleanWord, fontSize);

                if (currentX + wordWidth > width - margin && word.trim() !== '') {
                    y -= lineHeight;
                    currentX = margin;
                    if (y < margin) {
                        page = pdfDoc.addPage();
                        y = height - margin;
                    }
                }

                if (word.trim() !== '') {
                    page.drawText(cleanWord, { x: currentX, y, size: fontSize, font: partFont });
                }
                
                // Advance x. Even if word is just space, we advance.
                if (currentX === margin && word.trim() === '') {
                    // do nothing, skip leading space on new line
                } else {
                    currentX += wordWidth;
                }
            }
        }
        
        y -= lineHeight;
        
        // Add extra padding after headers
        if (isHeader) {
            y -= 4;
        }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
