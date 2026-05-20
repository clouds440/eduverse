export type FloatingPlacement = 'top' | 'bottom';

interface ViewportSize {
  width?: number;
  height?: number;
}

interface FloatingRect {
  width?: number;
  height?: number;
}

interface FloatingOptions {
  anchorRect?: DOMRect;
  point?: { x: number; y: number };
  floatingRect?: FloatingRect;
  viewport?: ViewportSize;
  margin?: number;
  gap?: number;
  preferredPlacement?: FloatingPlacement;
  minHeight?: number;
  matchAnchorWidth?: boolean;
}

export interface FloatingPosition {
  left: number;
  top: number;
  width?: number;
  maxHeight: number;
  placement: FloatingPlacement;
  overflowY: 'auto' | 'hidden';
}

export function getFloatingPosition({
  anchorRect,
  point,
  floatingRect,
  viewport,
  margin = 8,
  gap = 8,
  preferredPlacement = 'bottom',
  minHeight = 120,
  matchAnchorWidth = false,
}: FloatingOptions): FloatingPosition {
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const availableViewportHeight = Math.max(minHeight, viewportHeight - margin * 2);
  const renderedWidth = floatingRect?.width || anchorRect?.width || 160;
  const renderedHeight = floatingRect?.height || 0;
  const width = matchAnchorWidth && anchorRect ? anchorRect.width : undefined;
  const effectiveWidth = width || renderedWidth;

  if (anchorRect) {
    const spaceBelow = viewportHeight - anchorRect.bottom - margin - gap;
    const spaceAbove = anchorRect.top - margin - gap;
    const neededHeight = Math.min(
      renderedHeight || minHeight,
      availableViewportHeight,
    );
    const needsFlip =
      preferredPlacement === 'bottom'
        ? spaceBelow < neededHeight && spaceAbove > spaceBelow
        : spaceAbove >= neededHeight || spaceAbove > spaceBelow;
    const placement = needsFlip ? 'top' : 'bottom';
    const availableHeight = Math.max(
      80,
      placement === 'top' ? spaceAbove : spaceBelow,
    );
    const visibleHeight = Math.min(renderedHeight || availableHeight, availableHeight);
    const rawTop =
      placement === 'top'
        ? anchorRect.top - gap - visibleHeight
        : anchorRect.bottom + gap;
    const top = Math.min(
      Math.max(margin, rawTop),
      Math.max(margin, viewportHeight - visibleHeight - margin),
    );
    const left = Math.min(
      Math.max(margin, anchorRect.left),
      Math.max(margin, viewportWidth - effectiveWidth - margin),
    );

    return {
      left,
      top,
      width,
      maxHeight: availableHeight,
      placement,
      overflowY: renderedHeight > availableHeight ? 'auto' : 'hidden',
    };
  }

  const visibleHeight = Math.min(renderedHeight || availableViewportHeight, availableViewportHeight);
  const left = Math.min(
    Math.max(margin, point?.x ?? margin),
    Math.max(margin, viewportWidth - effectiveWidth - margin),
  );
  const top = Math.min(
    Math.max(margin, point?.y ?? margin),
    Math.max(margin, viewportHeight - visibleHeight - margin),
  );

  return {
    left,
    top,
    width,
    maxHeight: availableViewportHeight,
    placement: 'bottom',
    overflowY: renderedHeight > availableViewportHeight ? 'auto' : 'hidden',
  };
}
