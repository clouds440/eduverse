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
