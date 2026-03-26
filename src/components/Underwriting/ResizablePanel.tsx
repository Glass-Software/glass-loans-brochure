"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface ResizablePanelProps {
  children: ReactNode;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  onResize?: (width: number) => void;
}

export default function ResizablePanel({
  children,
  minWidth = 300,
  maxWidth = 600,
  defaultWidth = 400,
  onResize,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      const panelRight = panelRef.current.getBoundingClientRect().right;
      const newWidth = panelRight - e.clientX;

      // Constrain width between min and max
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(constrainedWidth);

      // Notify parent of resize
      if (onResize) {
        onResize(constrainedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // Prevent text selection while resizing
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minWidth, maxWidth, onResize]);

  return (
    <div
      ref={panelRef}
      className="@container relative h-full overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-ew-resize hover:bg-primary/50 active:bg-primary"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        title="Drag to resize"
      >
        {/* Visual indicator */}
        <div className="absolute left-0 top-1/2 h-12 w-1 -translate-y-1/2 bg-stroke dark:bg-stroke-dark" />
      </div>

      {/* Panel Content */}
      <div className="h-full pl-3">{children}</div>
    </div>
  );
}
