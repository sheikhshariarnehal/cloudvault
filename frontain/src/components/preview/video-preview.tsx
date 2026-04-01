"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

interface VideoPreviewProps {
  src: string;
}

export function VideoPreview({ src }: VideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayAttemptedRef = useRef(false);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 2500);
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      setCurrentTime(0);
    }
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (videoRef.current && isFinite(videoRef.current.duration)) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * videoRef.current.duration;
    }
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const toggleFullscreen = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  const attemptAutoPlay = useCallback(() => {
    if (!videoRef.current || autoPlayAttemptedRef.current) return;

    autoPlayAttemptedRef.current = true;
    videoRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        // Autoplay can still be blocked by browser policy; user can tap play.
        setIsPlaying(false);
      });
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowControls(true);
    setIsInitialLoading(true);
    setIsBuffering(false);
    setHasError(false);
    autoPlayAttemptedRef.current = false;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
  }, [src]);

  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const shouldShowControls = (showControls || !isPlaying) && !isInitialLoading && !hasError;
  const showOverlay = isInitialLoading || isBuffering || hasError;
  const loadingLabel = isInitialLoading ? "Loading video..." : "Buffering...";

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black flex items-center justify-center overflow-hidden group select-none ${
        !showControls && isPlaying ? "cursor-none" : "cursor-default"
      }`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={(e) => {
        if (isInitialLoading || hasError) return;
        togglePlay(e);
      }}
      onTouchStart={resetControlsTimeout}
    >
      {/* Inner shrink-wrapper so controls strictly adhere to video bounds */}
      <div className="relative flex items-center justify-center max-w-full max-h-full">
        <video
          ref={videoRef}
          src={src}
          className="max-w-full max-h-full object-contain outline-none"
          style={{ maxHeight: "100vh" }}
          preload="metadata"
          onLoadStart={() => {
            setIsInitialLoading(true);
            setIsBuffering(false);
            setHasError(false);
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onLoadedData={() => {
            setIsInitialLoading(false);
            setIsBuffering(false);
            attemptAutoPlay();
          }}
          onCanPlay={() => {
            setIsInitialLoading(false);
            setIsBuffering(false);
            attemptAutoPlay();
          }}
          onCanPlayThrough={() => {
            setIsInitialLoading(false);
            setIsBuffering(false);
          }}
          onWaiting={() => {
            if (!isInitialLoading) {
              setIsBuffering(true);
            }
          }}
          onStalled={() => {
            if (!isInitialLoading) {
              setIsBuffering(true);
            }
          }}
          onError={() => {
            autoPlayAttemptedRef.current = true;
            setHasError(true);
            setIsInitialLoading(false);
            setIsBuffering(false);
            setIsPlaying(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setShowControls(true);
          }}
          onPlay={() => {
            setIsPlaying(true);
            setIsBuffering(false);
          }}
          onPlaying={() => setIsBuffering(false)}
          onPause={() => setIsPlaying(false)}
          playsInline
        />

        {/* Controls Container */}
        {shouldShowControls && (
        <div
          className="absolute bottom-0 left-0 right-0 pt-10 sm:pt-16 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 flex flex-col gap-1 sm:gap-2 opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Progress Bar */}
        <div
          className="relative h-1 bg-white/25 cursor-pointer group/progress my-2 sm:my-3 w-full rounded-full overflow-hidden"
          onClick={handleProgressClick}
        >
          <div
            className="absolute left-0 top-0 h-full bg-[#ea4335] transition-[width] duration-100 ease-linear pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Bottom Controls - WITH PADDING */}
        <div className="flex items-center justify-between text-white px-2 sm:px-4 pb-2 sm:pb-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={togglePlay}
              className="text-white hover:text-gray-300 transition-colors focus:outline-none"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
            
            <button
              onClick={toggleMute}
              className="text-white hover:text-gray-300 transition-colors focus:outline-none"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            
            <span className="text-xs sm:text-sm font-medium tracking-wide opacity-90 font-mono sm:font-sans">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              className="text-white hover:text-gray-300 transition-colors focus:outline-none"
            >
              {/* Settings Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-gray-300 transition-colors focus:outline-none"
            >
              {isFullscreen ? <Minimize size={18} className="sm:w-5 sm:h-5" /> : <Maximize size={18} className="sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
        </div>
        )}
      </div>

      {showOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 pointer-events-none">
          {hasError ? (
            <div className="rounded-md bg-black/75 border border-white/20 px-4 py-2 text-white text-sm sm:text-base">
              Failed to load video
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white rounded-lg bg-black/45 border border-white/20 px-4 py-3 backdrop-blur-sm">
              <span className="h-9 w-9 rounded-full border-2 border-white/25 border-t-white animate-spin" />
              <span className="text-xs sm:text-sm tracking-wide opacity-95">
                {loadingLabel}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
