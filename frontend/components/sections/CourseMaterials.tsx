'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { ApiError, Role, CourseMaterial } from '@/types';
import {
  Archive,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileCode,
  FileImage,
  FileText,
  Globe,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExternalLinkInput } from '@/components/ui/ExternalLinkInput';
import { downloadFile, formatBytes } from '@/lib/utils';
import { CourseSectionLabel } from './SectionLabel';
import { GENERIC_UPLOAD_ACCEPT } from '@/lib/uploadPolicy';

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return Archive;
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml')) return FileCode;
  return FileText;
}

function getVideoEmbedUrl(url: string): string {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('v=')[1]?.split('&')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  if (url.includes('vimeo.com/')) {
    const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
    return `https://player.vimeo.com/video/${videoId}`;
  }
  return url;
}

interface CourseMaterialsProps {
  sectionId: string;
  role: Role;
  isTeacherAssigned?: boolean;
}

export default memo(function CourseMaterials({ sectionId, isTeacherAssigned = false }: CourseMaterialsProps) {
  const { token } = useAuth();
  const { dispatch } = useGlobal();
  const dispatchRef = useRef(dispatch);

  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<CourseMaterial | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<CourseMaterial | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<CourseMaterial | null>(null);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  const fetchMaterials = useCallback(async () => {
    if (!token || !sectionId) return;
    setIsLoading(true);
    try {
      const data = await api.courseMaterials.getMaterials(sectionId, token);
      setMaterials(data);
    } catch (error: unknown) {
      console.error('Failed to fetch materials:', error);
      const apiError = error as ApiError;
      const rawMessage = apiError.response?.data?.message || apiError.message || 'Failed to load materials';
      const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
      dispatchRef.current({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
    } finally {
      setIsLoading(false);
    }
  }, [token, sectionId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const handleDelete = async () => {
    if (!token || !deletingMaterial) return;
    const target = deletingMaterial;

    try {
      dispatch({ type: 'UI_START_PROCESSING', payload: `material-delete-${target.id}` });
      await api.courseMaterials.deleteMaterial(target.id, token);
      dispatch({ type: 'TOAST_ADD', payload: { message: 'Material deleted successfully', type: 'success' } });
      fetchMaterials();
      setDeletingMaterial(null);
    } catch (error) {
      console.error('Failed to delete material:', error);
      dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to delete material', type: 'error' } });
      setDeletingMaterial(null);
    } finally {
      dispatch({ type: 'UI_STOP_PROCESSING', payload: `material-delete-${target.id}` });
    }
  };

  const handleDownload = async (file: { path: string; filename: string }) => {
    try {
      await downloadFile(file.path, file.filename, token);
    } catch (error) {
      dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to download file', type: 'error' } });
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-44 min-w-0 animate-pulse rounded-lg border border-border/70 bg-muted/35" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground">{materials.length} materials</p>
          <p className="break-words text-xs font-semibold text-muted-foreground">Files, external links, and class resources shared with this section.</p>
        </div>
        {isTeacherAssigned && (
          <Button onClick={() => setShowUploadModal(true)} icon={Plus} className="w-full sm:w-auto">
            Add Material
          </Button>
        )}
      </div>

      {materials.length === 0 ? (
        <div className="min-w-0 rounded-lg border border-dashed border-border/70 bg-background/60 px-4 py-10 text-center sm:px-6">
          <FileText className="mx-auto h-9 w-9 text-muted-foreground/45" />
          <p className="mt-3 text-sm font-black text-foreground">No materials yet</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {isTeacherAssigned ? 'Add a file or link when students need a resource.' : 'Materials shared by the teaching team will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((material) => {
            const fileCount = material.files?.length || 0;
            const linkCount = material.links?.length || 0;

            return (
              <article key={material.id} className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border/70 bg-card p-3 shadow-sm sm:p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant="primary" size="sm" icon={FileText}>Material</Badge>
                      {material.isVideoLink && <Badge variant="info" size="sm">Video</Badge>}
                    </div>
                    <h3 className="mt-3 line-clamp-2 break-words text-base font-black leading-tight text-foreground">
                      {material.title}
                    </h3>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setViewingMaterial(material)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      aria-label={`View ${material.title}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {isTeacherAssigned && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingMaterial(material)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          aria-label={`Edit ${material.title}`}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingMaterial(material)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-danger/25 text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                          aria-label={`Delete ${material.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {material.description && (
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-muted-foreground">
                    {material.description}
                  </p>
                )}

                <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                  <span>Added {new Date(material.createdAt).toLocaleDateString()}</span>
                  {material.creator?.name && <span>by {material.creator.name}</span>}
                </div>

                <div className="mt-4 grid min-w-0 gap-2">
                  {fileCount > 0 && (
                    <div className="min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/70 p-3">
                      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-xs font-black text-foreground">
                          <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                          {fileCount} file{fileCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        {material.files?.slice(0, 2).map((file) => {
                          const FileIcon = getFileIcon(file.mimeType);
                          return (
                            <button
                              type="button"
                              key={file.id}
                              onClick={() => handleDownload(file)}
                              className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-primary/5"
                            >
                              <FileIcon className="h-4 w-4 shrink-0 text-primary" />
                              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{file.filename}</span>
                              <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{formatBytes(file.size)}</span>
                            </button>
                          );
                        })}
                      </div>
                      {fileCount > 2 && <p className="mt-2 text-xs font-bold text-muted-foreground">+{fileCount - 2} more files</p>}
                    </div>
                  )}

                  {linkCount > 0 && (
                    <div className="min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/70 p-3">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-black text-foreground">
                        <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                        {linkCount} link{linkCount === 1 ? '' : 's'}
                      </span>
                      <a
                        href={material.links?.[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                      >
                        <Globe className="h-4 w-4 shrink-0" />
                        <span className="truncate">{material.isVideoLink ? 'Open video resource' : 'Open external resource'}</span>
                      </a>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showUploadModal && (
        <UploadMaterialModal
          sectionId={sectionId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            fetchMaterials();
            setShowUploadModal(false);
          }}
        />
      )}

      {viewingMaterial && (
        <Modal
          isOpen={true}
          onClose={() => setViewingMaterial(null)}
          title="Course Material Details"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-black text-card-text">{viewingMaterial.title}</h3>
              {viewingMaterial.section?.name && (
                <CourseSectionLabel section={viewingMaterial.section} as="p" className="mt-1 text-xs font-black uppercase tracking-widest" />
              )}
              {viewingMaterial.description && (
                <p className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">{viewingMaterial.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
              <span>Added {new Date(viewingMaterial.createdAt).toLocaleDateString()}</span>
              {viewingMaterial.creator?.name && <span>by {viewingMaterial.creator.name}</span>}
            </div>

            {viewingMaterial.files && viewingMaterial.files.length > 0 && (
              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attached Files</p>
                <div className="space-y-2">
                  {viewingMaterial.files.map((file) => {
                    const FileIcon = getFileIcon(file.mimeType);
                    return (
                      <div key={file.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
                        <FileIcon className="h-5 w-5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-card-text/80">{file.filename}</span>
                        <span className="hidden text-xs font-bold text-muted-foreground sm:inline">{formatBytes(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => handleDownload(file)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
                          aria-label={`Download ${file.filename}`}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewingMaterial.links && viewingMaterial.links.length > 0 && (
              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">External Links</p>
                <div className="space-y-3">
                  {viewingMaterial.links.map((link, index) => (
                    <div key={`${link}-${index}`}>
                      {viewingMaterial.isVideoLink ? (
                        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black shadow-sm">
                          <iframe
                            src={getVideoEmbedUrl(link)}
                            className="h-full w-full"
                            title="Embedded video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3 text-primary transition-colors hover:bg-primary/5"
                        >
                          <Globe className="h-5 w-5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">External resource</span>
                          <ExternalLink className="h-4 w-4 shrink-0" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setViewingMaterial(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editingMaterial && (
        <UploadMaterialModal
          sectionId={sectionId}
          material={editingMaterial}
          onClose={() => setEditingMaterial(null)}
          onSuccess={() => {
            fetchMaterials();
            setEditingMaterial(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingMaterial}
        onClose={() => setDeletingMaterial(null)}
        onConfirm={handleDelete}
        title="Delete Material"
        description={`Are you sure you want to delete "${deletingMaterial?.title}"? This will also remove all attached files.`}
        confirmText="Delete Material"
        isDestructive={true}
        loadingId={deletingMaterial ? `material-delete-${deletingMaterial.id}` : undefined}
      />
    </div>
  );
});

function UploadMaterialModal({
  sectionId,
  material,
  onClose,
  onSuccess,
}: {
  sectionId: string;
  material?: CourseMaterial | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { token } = useAuth();
  const { state, dispatch } = useGlobal();
  const [title, setTitle] = useState(material?.title || '');
  const [description, setDescription] = useState(material?.description || '');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{ id: string, filename: string, path: string, mimeType: string, size: number }>>(material?.files || []);
  const [filesToRemove, setFilesToRemove] = useState<string[]>([]);
  const [externalLink, setExternalLink] = useState('');
  const [isVideoLink, setIsVideoLink] = useState(false);

  useEffect(() => {
    if (material) {
      setTitle(material.title);
      setDescription(material.description || '');
      setExistingFiles(material.files || []);
      setExternalLink(material.links?.[0] || '');
      setIsVideoLink(material.isVideoLink || false);
    }
  }, [material]);

  const handleFileUpload = (files: FileList) => {
    setPendingFiles((current) => [...current, ...Array.from(files)]);
  };

  const handleRemoveFile = (index: number) => {
    setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleRemoveExistingFile = (fileId: string) => {
    setFilesToRemove((current) => [...current, fileId]);
    setExistingFiles((current) => current.filter((file) => file.id !== fileId));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !title) return;

    try {
      dispatch({ type: 'UI_START_PROCESSING', payload: material ? `material-edit-${material.id}` : 'material-create' });
      if (material) {
        const orgId = state.auth.user?.orgId || state.auth.user?.organizationId;
        const uploadedFileIds: string[] = [];

        if (orgId && pendingFiles.length > 0) {
          for (const file of pendingFiles) {
            const data = await api.files.uploadFile(orgId, 'COURSE_MATERIAL', material.id, file, token);
            uploadedFileIds.push(data.id!);
          }
        }

        await api.courseMaterials.updateMaterial(
          material.id,
          { title, description, fileIds: uploadedFileIds, filesToRemove, links: externalLink ? [externalLink] : [], isVideoLink },
          token,
        );

        dispatch({ type: 'TOAST_ADD', payload: { message: 'Material updated successfully', type: 'success' } });
        onSuccess();
      } else {
        const orgId = state.auth.user?.orgId || state.auth.user?.organizationId;
        const uploadedFileIds: string[] = [];

        if (orgId && pendingFiles.length > 0) {
          for (const file of pendingFiles) {
            const data = await api.files.uploadFile(orgId, 'COURSE_MATERIAL', 'temp', file, token);
            uploadedFileIds.push(data.id!);
          }
        }

        await api.courseMaterials.createMaterial(
          sectionId,
          { title, description, fileIds: uploadedFileIds, links: externalLink ? [externalLink] : [], isVideoLink },
          token,
        );

        dispatch({ type: 'TOAST_ADD', payload: { message: 'Material created successfully', type: 'success' } });
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to save material:', error);
      dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to save material', type: 'error' } });
    } finally {
      dispatch({ type: 'UI_STOP_PROCESSING', payload: material ? `material-edit-${material.id}` : 'material-create' });
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={material ? 'Edit Course Material' : 'Upload Course Material'}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="e.g. Lecture Notes - Week 1"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-25 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Optional description of the material..."
            rows={4}
          />
        </div>

        <ExternalLinkInput
          value={externalLink}
          onChange={setExternalLink}
          isVideo={isVideoLink}
          onIsVideoChange={setIsVideoLink}
          disabled={state.ui.processing['material-create'] || Boolean(material && state.ui.processing[`material-edit-${material.id}`])}
        />

        <div>
          <label className="mb-2 block text-sm font-semibold">Files</label>
          <div className="rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50">
            <input
              type="file"
              multiple
              onChange={(event) => event.target.files && handleFileUpload(event.target.files)}
              accept={GENERIC_UPLOAD_ACCEPT}
              className="hidden"
              id="file-upload"
              disabled={state.ui.processing['material-create'] || Boolean(material && state.ui.processing[`material-edit-${material.id}`])}
            />
            <label htmlFor="file-upload" className="flex cursor-pointer flex-col items-center gap-3">
              <Upload className="h-8 w-8 text-muted-foreground/60" />
              <span className="text-sm font-semibold text-muted-foreground">
                {state.ui.processing['material-create'] || Boolean(material && state.ui.processing[`material-edit-${material.id}`]) ? 'Uploading...' : 'Click to upload files'}
              </span>
              <span className="text-xs font-semibold text-muted-foreground/70">
                PDF, Office files, images, ZIP, and source code
              </span>
            </label>
          </div>

          {(pendingFiles.length > 0 || existingFiles.length > 0) && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {material ? 'Files' : 'Staged Files'}
              </p>

              {existingFiles.map((file) => {
                const FileIcon = getFileIcon(file.mimeType);
                return (
                  <div key={file.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                    <FileIcon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-card-text/80">{file.filename}</span>
                    <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingFile(file.id)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label={`Remove ${file.filename}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              {pendingFiles.map((file, index) => {
                const FileIcon = getFileIcon(file.type);
                return (
                  <div key={`${file.name}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <FileIcon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-card-text/80">{file.name}</span>
                    <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loadingId={material ? `material-edit-${material.id}` : 'material-create'} disabled={!title}>
            {material ? 'Update Material' : 'Create Material'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
