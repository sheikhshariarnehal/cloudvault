"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, AlertCircle, Download, ChevronLeft, ChevronRight } from "lucide-react";

interface PptxPreviewProps {
  src: string;
  fileName: string;
  onDownload?: () => void;
}

/** Represents a text block extracted from a shape on a slide. */
interface TextBlock {
  /** "title" | "ctrTitle" | "subTitle" | "body" | "other" */
  role: string;
  paragraphs: string[];
  /** Bullet level per paragraph (0 = no bullet) */
  levels: number[];
}

interface SlideData {
  index: number;
  blocks: TextBlock[];
  notes: string;
}

/* ── Namespace helpers ── */
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";

/** Walk <p:sp> shapes and group text by placeholder type. */
function extractShapeBlocks(doc: Document): TextBlock[] {
  const shapes = doc.getElementsByTagNameNS(NS_P, "sp");
  const blocks: TextBlock[] = [];

  for (let s = 0; s < shapes.length; s++) {
    const shape = shapes[s];

    // Determine placeholder type  <p:ph type="title|ctrTitle|subTitle|body|..."/>
    let role = "other";
    const phElements = shape.getElementsByTagNameNS(NS_P, "ph");
    if (phElements.length > 0) {
      role = phElements[0].getAttribute("type") || "body";
    }

    // Extract paragraphs (<a:p>) from the shape's text body
    const txBody = shape.getElementsByTagNameNS(NS_P, "txBody");
    const bodyEl = txBody.length > 0 ? txBody[0] : shape;
    const paras = bodyEl.getElementsByTagNameNS(NS_A, "p");
    const paragraphs: string[] = [];
    const levels: number[] = [];

    for (let p = 0; p < paras.length; p++) {
      const pNode = paras[p];
      const runs = pNode.getElementsByTagNameNS(NS_A, "t");
      let text = "";
      for (let r = 0; r < runs.length; r++) {
        text += runs[r].textContent || "";
      }
      if (text.trim()) {
        paragraphs.push(text);
        // Bullet level from <a:pPr lvl="1">
        const pPr = pNode.getElementsByTagNameNS(NS_A, "pPr");
        const lvl = pPr.length > 0 ? parseInt(pPr[0].getAttribute("lvl") || "0", 10) : 0;
        levels.push(lvl);
      }
    }

    if (paragraphs.length > 0) {
      blocks.push({ role, paragraphs, levels });
    }
  }
  return blocks;
}

/**
 * Client-side PPTX preview — Google-Slides-style layout with a left
 * thumbnail panel, a centred slide card, and keyboard navigation.
 */
export function PptxPreview({ src, fileName, onDownload }: PptxPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const thumbListRef = useRef<HTMLDivElement>(null);

  /* ── Keyboard navigation ── */
  const goPrev = useCallback(() => setCurrentSlide((s) => Math.max(0, s - 1)), []);
  const goNext = useCallback(
    () => setCurrentSlide((s) => Math.min(slides.length - 1, s + 1)),
    [slides.length]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

  /* ── Auto-scroll thumbnail into view ── */
  useEffect(() => {
    const list = thumbListRef.current;
    if (!list) return;
    const active = list.querySelector(`[data-slide-index="${currentSlide}"]`) as HTMLElement | null;
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentSlide]);

  /* ── Parse PPTX ── */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(src);
        if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(buffer);

        // Collect slide file entries
        const slideFiles: { index: number; path: string }[] = [];
        zip.forEach((p) => {
          const m = p.match(/^ppt\/slides\/slide(\d+)\.xml$/);
          if (m) slideFiles.push({ index: parseInt(m[1], 10), path: p });
        });
        slideFiles.sort((a, b) => a.index - b.index);

        if (slideFiles.length === 0) throw new Error("No slides found in this file");

        const parser = new DOMParser();
        const extracted: SlideData[] = [];

        for (const sf of slideFiles) {
          const xml = await zip.file(sf.path)!.async("string");
          const doc = parser.parseFromString(xml, "application/xml");
          const blocks = extractShapeBlocks(doc);

          // Notes
          let notes = "";
          const noteFile = zip.file(`ppt/notesSlides/notesSlide${sf.index}.xml`);
          if (noteFile) {
            try {
              const nxml = await noteFile.async("string");
              const ndoc = parser.parseFromString(nxml, "application/xml");
              const nts = ndoc.getElementsByTagNameNS(NS_A, "t");
              const parts: string[] = [];
              for (let i = 0; i < nts.length; i++) {
                const t = nts[i].textContent?.trim();
                if (t && !/^\d+$/.test(t)) parts.push(t);
              }
              notes = parts.join(" ");
            } catch { /* ignore */ }
          }

          extracted.push({ index: sf.index, blocks, notes });
        }

        if (!cancelled) { setSlides(extracted); setCurrentSlide(0); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to parse PPTX");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [src]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-white/40 animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/50">Parsing PowerPoint…</p>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-2">Cannot preview PowerPoint</p>
          <p className="text-sm text-white/50 mb-4">{error}</p>
          {onDownload && (
            <button onClick={onDownload} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-medium hover:bg-[#aecbfa] transition-colors">
              <Download className="h-4 w-4" /> Download File
            </button>
          )}
        </div>
      </div>
    );
  }

  const slide = slides[currentSlide];
  const hasAnyNotes = slides.some((s) => s.notes);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#1a1a1a]">
      {/* ═══ Main area: thumbnail sidebar + slide ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Slide thumbnail panel ── */}
        <div
          ref={thumbListRef}
          className="w-[180px] flex-shrink-0 overflow-y-auto border-r border-white/[0.08] bg-[#1e1e1e] py-3 px-3 space-y-2 hidden md:block"
        >
          {slides.map((s, idx) => {
            const isActive = idx === currentSlide;
            const title = s.blocks.find((b) => b.role === "title" || b.role === "ctrTitle")?.paragraphs[0]
              || s.blocks[0]?.paragraphs[0]
              || "";
            const subtitle = s.blocks.find((b) => b.role === "subTitle")?.paragraphs[0]
              || (s.blocks.find((b) => b.role === "body")?.paragraphs[0])
              || "";

            return (
              <div
                key={idx}
                data-slide-index={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`group relative cursor-pointer rounded-md transition-all duration-150 ${
                  isActive
                    ? "ring-2 ring-[#4285f4]"
                    : "ring-1 ring-white/[0.08] hover:ring-white/20"
                }`}
              >
                {/* Slide number badge */}
                <span className={`absolute -left-0.5 top-1 text-[10px] font-medium w-5 text-center ${
                  isActive ? "text-[#8ab4f8]" : "text-white/30"
                }`}>
                  {idx + 1}
                </span>

                {/* Mini slide card */}
                <div className="bg-white rounded-[4px] aspect-[16/10] overflow-hidden px-3 py-2 flex flex-col justify-center ml-1">
                  {title && (
                    <p className="text-[7px] font-bold text-gray-900 leading-tight truncate">
                      {title}
                    </p>
                  )}
                  {subtitle && (
                    <p className="text-[6px] text-gray-500 leading-tight truncate mt-0.5">
                      {subtitle}
                    </p>
                  )}
                  {!title && !subtitle && (
                    <p className="text-[6px] text-gray-300 italic text-center">Empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Centre: Current slide view ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Slide canvas area */}
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
            {/* Prev button */}
            <button
              onClick={goPrev}
              disabled={currentSlide === 0}
              className="absolute left-2 md:left-5 z-10 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-0 disabled:pointer-events-none transition-all"
              title="Previous slide"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            {/* ─ Slide card ─ */}
            <div className="w-full max-w-4xl mx-auto">
              <div className="relative bg-white rounded shadow-[0_2px_20px_rgba(0,0,0,0.35)] aspect-[16/9.5] overflow-hidden">
                <div className="absolute inset-0 overflow-auto px-[8%] py-[6%] flex flex-col">
                  {slide && slide.blocks.length > 0 ? (
                    slide.blocks.map((block, bi) => {
                      // Title shapes
                      if (block.role === "title" || block.role === "ctrTitle") {
                        const isCentre = block.role === "ctrTitle";
                        return (
                          <div key={bi} className={`mb-5 ${isCentre ? "text-center mt-auto" : ""}`}>
                            {block.paragraphs.map((t, pi) => (
                              <h2
                                key={pi}
                                className={`font-bold text-[#1a1a2e] leading-tight ${
                                  isCentre
                                    ? "text-2xl md:text-4xl"
                                    : "text-xl md:text-3xl"
                                }`}
                              >
                                {t}
                              </h2>
                            ))}
                          </div>
                        );
                      }

                      // Subtitle shapes
                      if (block.role === "subTitle") {
                        return (
                          <div key={bi} className="mb-5 text-center">
                            {block.paragraphs.map((t, pi) => (
                              <p key={pi} className="text-base md:text-xl text-gray-500 leading-snug">
                                {t}
                              </p>
                            ))}
                          </div>
                        );
                      }

                      // Body / bullet content
                      return (
                        <div key={bi} className="mb-4">
                          {block.paragraphs.map((t, pi) => {
                            const lvl = block.levels[pi] || 0;
                            const ml = lvl * 20;
                            const bullet = lvl === 0 ? "•" : lvl === 1 ? "◦" : "▪";
                            return (
                              <div
                                key={pi}
                                className="flex items-start gap-2 mb-1"
                                style={{ marginLeft: ml }}
                              >
                                <span className="text-gray-400 mt-[3px] flex-shrink-0 text-sm select-none">
                                  {bullet}
                                </span>
                                <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                                  {t}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-gray-300 italic text-sm">(No text content on this slide)</p>
                    </div>
                  )}
                </div>

                {/* Slide number watermark */}
                <span className="absolute bottom-3 right-4 text-[11px] text-gray-300 font-medium select-none">
                  {currentSlide + 1}
                </span>
              </div>
            </div>

            {/* Next button */}
            <button
              onClick={goNext}
              disabled={currentSlide === slides.length - 1}
              className="absolute right-2 md:right-5 z-10 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-0 disabled:pointer-events-none transition-all"
              title="Next slide"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Speaker notes panel (collapsible) */}
          {hasAnyNotes && showNotes && slide?.notes && (
            <div className="border-t border-white/[0.08] bg-[#252526] px-6 py-3 max-h-28 overflow-y-auto flex-shrink-0">
              <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1 font-medium">Speaker Notes</p>
              <p className="text-sm text-white/60 leading-relaxed">{slide.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Bottom bar ═══ */}
      <div className="flex items-center justify-between h-10 px-4 bg-[#252526] border-t border-white/[0.08] flex-shrink-0">
        {/* Left: slide position */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">
            Slide <span className="text-white/80 font-medium">{currentSlide + 1}</span> of{" "}
            <span className="text-white/80 font-medium">{slides.length}</span>
          </span>
        </div>

        {/* Centre: mini pager (mobile replacement for sidebar) */}
        <div className="flex items-center gap-1 md:hidden">
          <button onClick={goPrev} disabled={currentSlide === 0} className="p-1 text-white/40 hover:text-white disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={goNext} disabled={currentSlide === slides.length - 1} className="p-1 text-white/40 hover:text-white disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Right: notes toggle */}
        <div className="flex items-center gap-2">
          {hasAnyNotes && (
            <button
              onClick={() => setShowNotes((n) => !n)}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                showNotes ? "bg-white/10 text-white/80" : "text-white/40 hover:text-white/60"
              }`}
            >
              Notes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
