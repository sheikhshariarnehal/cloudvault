"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

interface ImagePreviewProps {
  src: string;
  alt: string;
}

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export function ImagePreview({ src, alt }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prev) => Math.min(Math.max(prev + delta, MIN_ZOOM), MAX_ZOOM));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    },
    [zoom, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

  // Reset position when zoom resets to 1
  useEffect(() => {
    if (zoom <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
        }}
      >
        {/* Loading spinner */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <img
          src={src}
          alt={alt}
          className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transition: isDragging ? "none" : "transform 0.2s ease",
          }}
          onLoad={() => setIsLoaded(true)}
          onDoubleClick={handleDoubleClick}
          draggable={false}
        />
      </div>

      {/* Bottom zoom controls - Google Drive style */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#2d2e30] rounded-full px-2 py-1 shadow-lg z-10">
        <button
          onClick={handleZoomOut}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors min-w-[60px] text-center font-medium"
          title="Reset zoom"
        >
          {zoomPercent}%
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
