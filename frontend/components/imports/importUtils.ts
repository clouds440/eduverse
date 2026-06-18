'use client';

export function downloadCsv(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function formatImportErrors(errors: { field?: string; message: string }[]) {
    return errors.map((error) => error.field ? `${error.field}: ${error.message}` : error.message).join('; ');
}
