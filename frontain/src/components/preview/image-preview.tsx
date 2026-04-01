"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

interface ImagePreviewProps {
  src: string;
  alt: string;
  fallbackSrc?: string | null;
}

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export function ImagePreview({ src, alt, fallbackSrc }: ImagePreviewProps) {
  const [zoomState, setZoomState] = useState(1);
  const zoomRef = useRef(1);

  const positionRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | undefined>(undefined);

  const [isLoaded, setIsLoaded] = useState(false);      // full-res image ready
  const [hasError, setHasError] = useState(false);      // full-res image failed
  const [usingFallback, setUsingFallback] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLImageElement>(null);
  const fullResRef = useRef<HTMLImageElement>(null);

  const applyTransform = useCallback(() => {
    const currentZoom = zoomRef.current;
    const { x, y } = positionRef.current;
    const transform = `scale(${currentZoom}) translate(${x / currentZoom}px, ${y / currentZoom}px)`;
    
    const fallbackTransition = isDraggingRef.current 
      ? "opacity 0.5s ease" 
      : "transform 0.2s ease, opacity 0.7s ease";
    
    const fullResTransition = isDraggingRef.current 
      ? "opacity 0.2s ease" 
      : "transform 0.2s ease, opacity 0.7s ease";

    if (fallbackRef.current) {
      fallbackRef.current.style.transform = transform;
      fallbackRef.current.style.transition = fallbackTransition;
    }
    if (fullResRef.current) {
      fullResRef.current.style.transform = transform;
      fullResRef.current.style.transition = fullResTransition;
    }
    
    if (containerRef.current) {
      containerRef.current.style.cursor = currentZoom > 1 
        ? (isDraggingRef.current ? "grabbing" : "grab") 
        : "zoom-in";
    }
  }, []);

  const setZoom = useCallback((updater: number | ((z: number) => number)) => {
    const nextZoom = typeof updater === "function" ? updater(zoomRef.current) : updater;
    zoomRef.current = nextZoom;
    setZoomState(nextZoom);
    applyTransform();
  }, [applyTransform]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, [setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, [setZoom]);

  const handleReset = useCallback(() => {
    setZoom(1);
    positionRef.current = { x: 0, y: 0 };
    applyTransform();
  }, [setZoom, applyTransform]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((prev) => Math.min(Math.max(prev + delta, MIN_ZOOM), MAX_ZOOM));
    };

    container.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => container.removeEventListener("wheel", handleWheelNative);
  }, [setZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomRef.current <= 1) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
    
    applyTransform();

    const handleWindowMouseMove = (evt: MouseEvent) => {
      if (!isDraggingRef.current) return;
      positionRef.current = {
        x: evt.clientX - dragStartRef.current.x,
        y: evt.clientY - dragStartRef.current.y,
      };
      
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        applyTransform();
      });
    };

    const handleWindowMouseUp = () => {
      isDraggingRef.current = false;
      applyTransform();
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
  }, [applyTransform]);

  const handleDoubleClick = useCallback(() => {
    if (zoomRef.current === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      positionRef.current = { x: 0, y: 0 };
      applyTransform();
    }
  }, [setZoom, applyTransform]);

  // Reset position when zoom resets to 1
  useEffect(() => {
    if (zoomState <= 1) {
      positionRef.current = { x: 0, y: 0 };
      applyTransform();
    }
  }, [zoomState, applyTransform]);

  // Reset load state when src changes (navigating between images)
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setUsingFallback(false);
    setRetryKey(k => k + 1);
    setZoom(1);
    positionRef.current = { x: 0, y: 0 };
    applyTransform();
  }, [src, setZoom, applyTransform]);

  useEffect(() => {
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const zoomPercent = Math.round(zoomState * 100);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden select-none"
        onMouseDown={handleMouseDown}
        style={{ cursor: "zoom-in" }}
      >
        {/* ── Thumbnail placeholder (shown IMMEDIATELY while full image loads) ── */}
        {/* Blurred, low-opacity background — gives instant visual feedback.      */}
        {/* Fades out the moment the full-res image is ready.                     */}
        {fallbackSrc ? (
          <img
            ref={fallbackRef}
            src={fallbackSrc}
            alt=""
            aria-hidden
            className={`absolute max-w-full max-h-full object-contain pointer-events-none select-none
              transition-opacity duration-700 blur-xl
              ${isLoaded || hasError ? "opacity-0" : "opacity-40"}`}
            style={{
              transform: "scale(1) translate(0px, 0px)",
              transition: "transform 0.2s ease, opacity 0.7s ease",
            }}
            draggable={false}
          />
        ) : null}

        {/* Loading spinner — always shown in the center when not loaded */}
        {!isLoaded && !hasError ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white/90 rounded-full animate-spin shadow-lg" />
          </div>
        ) : null}

        {/* Error state (full-res failed AND no fallback, or both failed) */}
        {hasError && !usingFallback ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
            <svg className="w-16 h-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm font-medium">Failed to load image</p>
            <button
              onClick={() => { setHasError(false); setIsLoaded(false); setRetryKey(k => k + 1); }}
              className="text-xs text-[#8ab4f8] hover:text-[#aecbfa] underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        {/* Full-resolution image — hidden (opacity-0) until loaded, then fades in */}
        <img
          key={retryKey}
          ref={fullResRef}
          src={usingFallback && fallbackSrc ? fallbackSrc : src}
          alt={alt}
          className={`max-w-full max-h-full object-contain transition-opacity duration-700 ${
            isLoaded && !hasError ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transform: "scale(1) translate(0px, 0px)",
            transition: "transform 0.2s ease, opacity 0.7s ease",
          }}
          onLoad={() => { setIsLoaded(true); setHasError(false); }}
          onError={() => {
            if (!usingFallback && fallbackSrc) {
              setUsingFallback(true);
              setHasError(false);
              setIsLoaded(false);
            } else {
              setHasError(true);
              setIsLoaded(false);
            }
          }}
          onDoubleClick={handleDoubleClick}
          draggable={false}
        />
      </div>

      {/* Fallback quality banner (shown when permanently on thumbnail after full-res fails) */}
      {usingFallback && isLoaded ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#2d2e30]/90 backdrop-blur rounded-full px-4 py-2 shadow-lg z-10">
          <span className="text-xs text-white/70">Showing thumbnail preview</span>
          <button
            onClick={() => { setUsingFallback(false); setHasError(false); setIsLoaded(false); setRetryKey(k => k + 1); }}
            className="text-xs text-[#8ab4f8] hover:text-[#aecbfa] font-medium"
          >
            Load full image
          </button>
        </div>
      ) : null}

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
