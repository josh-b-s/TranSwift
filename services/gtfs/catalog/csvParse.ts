/** Parses CSV text into rows of cells. Handles quoted fields, "" escapes and CRLF. */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;

    const endRow = () => {
        row.push(cell);
        cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
    };

    for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch !== '"') cell += ch;
            else if (text[i + 1] === '"') { cell += '"'; i++; }
            else quoted = false;
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            endRow();
        } else {
            cell += ch;
        }
    }
    if (cell !== '' || row.length > 0) endRow();
    return rows;
}
