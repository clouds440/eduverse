export const GENERIC_UPLOAD_EXTENSIONS = [
    '.c',
    '.cpp',
    '.cs',
    '.css',
    '.doc',
    '.docx',
    '.gif',
    '.go',
    '.h',
    '.hpp',
    '.html',
    '.java',
    '.jpeg',
    '.jpg',
    '.js',
    '.json',
    '.jsx',
    '.md',
    '.pdf',
    '.php',
    '.png',
    '.ppt',
    '.pptx',
    '.py',
    '.rb',
    '.rs',
    '.sql',
    '.svg',
    '.ts',
    '.tsx',
    '.txt',
    '.webp',
    '.xls',
    '.xlsx',
    '.xml',
    '.zip',
] as const;

export const GENERIC_UPLOAD_ACCEPT = GENERIC_UPLOAD_EXTENSIONS.join(',');
export const CODE_UPLOAD_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
export const ANSWERBOOK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ANSWERBOOK_PDF_MAX_BYTES = 50 * 1024 * 1024;
export const ANSWERBOOK_MAX_FILES = 5;
export const ANSWERBOOK_UPLOAD_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const;
export const ANSWERBOOK_UPLOAD_ACCEPT = ANSWERBOOK_UPLOAD_EXTENSIONS.join(',');

const GENERIC_UPLOAD_EXTENSION_SET = new Set<string>(GENERIC_UPLOAD_EXTENSIONS);

export function getFileExtension(filename: string) {
    const match = filename.toLowerCase().match(/\.[^.]+$/);
    return match?.[0] || '';
}

export function isGenericUploadAllowed(file: File) {
    return GENERIC_UPLOAD_EXTENSION_SET.has(getFileExtension(file.name));
}

export function isCodeLikeUpload(file: File) {
    const extension = getFileExtension(file.name);
    return [
        '.c',
        '.cpp',
        '.cs',
        '.css',
        '.go',
        '.h',
        '.hpp',
        '.html',
        '.java',
        '.js',
        '.json',
        '.jsx',
        '.md',
        '.php',
        '.py',
        '.rb',
        '.rs',
        '.sql',
        '.svg',
        '.ts',
        '.tsx',
        '.txt',
        '.xml',
    ].includes(extension);
}

export function getAnswerbookUploadError(file: File) {
    const extension = getFileExtension(file.name);
    if (!ANSWERBOOK_UPLOAD_EXTENSIONS.includes(extension as typeof ANSWERBOOK_UPLOAD_EXTENSIONS[number])) {
        return 'Answerbooks must be PDF, JPG, JPEG, PNG, or WEBP files.';
    }
    const limit = extension === '.pdf' ? ANSWERBOOK_PDF_MAX_BYTES : ANSWERBOOK_IMAGE_MAX_BYTES;
    if (file.size > limit) {
        return extension === '.pdf' ? 'PDF answerbooks must be 50 MB or smaller.' : 'Answerbook images must be 5 MB or smaller.';
    }
    return null;
}
