export const OFFICE_FILE_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint'
]);

export const WORD_FILE_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
]);

export const SPREADSHEET_FILE_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
]);

export const PRESENTATION_FILE_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
]);

export const ARCHIVE_FILE_TYPES = new Set([
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/vnd.rar',
]);

export const ALLOWED_UPLOAD_TYPES = new Set([
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-zip-compressed',
    'application/x-rar-compressed', 'application/vnd.rar',
]);

export function getFileTypeInfo(fileType: string) {
    const isPdf = fileType === 'application/pdf';
    const isWord = WORD_FILE_TYPES.has(fileType);
    const isSpreadsheet = SPREADSHEET_FILE_TYPES.has(fileType);
    const isPresentation = PRESENTATION_FILE_TYPES.has(fileType);
    const isArchive = ARCHIVE_FILE_TYPES.has(fileType);

    if (isPdf) return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        label: 'PDF',
        tag: 'PDF:'
    };
    if (isWord) return {
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        label: 'DOC',
        tag: 'DOC:'
    };
    if (isSpreadsheet) return {
        color: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.1)',
        label: 'XLS',
        tag: 'XLS:'
    };
    if (isPresentation) return {
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.1)',
        label: 'PPT',
        tag: 'PPT:'
    };
    if (isArchive) return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        label: 'ARCHIVE',
        tag: 'ARCHIVE:'
    };
    return {
        color: '#64748b',
        bg: 'rgba(100, 116, 139, 0.1)',
        label: 'FILE',
        tag: 'Attachment:'
    };
}
