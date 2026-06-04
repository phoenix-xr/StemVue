"use client";

import React, { useState, useEffect } from 'react';

interface YouTubeResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
  duration: string;
  views: number;
}

interface VideoSuggestionsProps {
  searchQuery: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoSuggestions({ searchQuery, isOpen, onClose }: VideoSuggestionsProps) {
  const [videos, setVideos] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !searchQuery) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/youtube?q=${encodeURIComponent(searchQuery)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        if (!cancelled) setVideos(data);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, searchQuery]);

  if (!isOpen) return null;

  const fallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;

  return (
    <div className="video-suggestions-panel">
      {/* Header */}
      <div className="video-suggestions-header">
        <div className="video-suggestions-header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
          </svg>
          <span>Related Videos</span>
        </div>
        <button onClick={onClose} className="video-suggestions-close" title="Close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="video-suggestions-body">
        {loading && (
          <div className="video-suggestions-loading">
            <div className="video-suggestions-spinner" />
            <span>Finding videos...</span>
          </div>
        )}

        {error && (
          <div className="video-suggestions-error">
            <span>Couldn&apos;t load videos.</span>
            <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="video-suggestions-fallback-link">
              Search YouTube →
            </a>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="video-suggestions-error">
            <span>No videos found.</span>
            <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="video-suggestions-fallback-link">
              Search YouTube →
            </a>
          </div>
        )}

        {!loading && !error && videos.length > 0 && (
          <div className="video-suggestions-grid">
            {videos.map((v) => (
              <a
                key={v.videoId}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="video-card"
              >
                <div className="video-card-thumb">
                  <img src={v.thumbnail} alt={v.title} loading="lazy" />
                  {v.duration && (
                    <span className="video-card-duration">{v.duration}</span>
                  )}
                  <div className="video-card-play-overlay">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                <div className="video-card-info">
                  <p className="video-card-title">{v.title}</p>
                  <p className="video-card-channel">{v.channelTitle}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .video-suggestions-panel {
          margin-top: 8px;
          margin-bottom: 16px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(96, 165, 250, 0.12);
          border-radius: 12px;
          overflow: hidden;
          animation: videoSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes videoSlideIn {
          from { opacity: 0; transform: translateY(-8px); max-height: 0; }
          to   { opacity: 1; transform: translateY(0);    max-height: 400px; }
        }

        .video-suggestions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-bottom: 1px solid rgba(96, 165, 250, 0.08);
          background: rgba(96, 165, 250, 0.04);
        }

        .video-suggestions-header-left {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(147, 197, 253, 0.7);
        }

        .video-suggestions-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: rgba(148, 163, 184, 0.5);
          cursor: pointer;
          transition: all 0.15s;
        }
        .video-suggestions-close:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .video-suggestions-body {
          padding: 10px 14px 14px;
        }

        .video-suggestions-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          color: rgba(148, 163, 184, 0.7);
          padding: 8px 0;
        }

        .video-suggestions-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(96, 165, 250, 0.15);
          border-top-color: rgba(96, 165, 250, 0.7);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .video-suggestions-error {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.75rem;
          color: rgba(148, 163, 184, 0.6);
          padding: 4px 0;
        }

        .video-suggestions-fallback-link {
          color: rgba(96, 165, 250, 0.8);
          text-decoration: none;
          font-weight: 600;
          transition: color 0.15s;
        }
        .video-suggestions-fallback-link:hover {
          color: #60a5fa;
        }

        .video-suggestions-grid {
          display: flex;
          gap: 10px;
        }

        .video-card {
          flex: 1;
          min-width: 0;
          text-decoration: none;
          color: inherit;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(51, 65, 85, 0.5);
          background: rgba(30, 41, 59, 0.6);
          transition: all 0.2s ease;
        }
        .video-card:hover {
          border-color: rgba(96, 165, 250, 0.3);
          background: rgba(30, 41, 59, 0.9);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .video-card-thumb {
          position: relative;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          background: #0f172a;
        }
        .video-card-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .video-card:hover .video-card-thumb img {
          transform: scale(1.05);
        }

        .video-card-duration {
          position: absolute;
          bottom: 4px;
          right: 4px;
          background: rgba(0, 0, 0, 0.85);
          color: #fff;
          font-size: 0.6rem;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 3px;
          letter-spacing: 0.02em;
          font-variant-numeric: tabular-nums;
        }

        .video-card-play-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.35);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .video-card:hover .video-card-play-overlay {
          opacity: 1;
        }

        .video-card-info {
          padding: 8px 10px;
        }

        .video-card-title {
          font-size: 0.7rem;
          font-weight: 600;
          color: #e2e8f0;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin: 0 0 4px;
        }

        .video-card-channel {
          font-size: 0.6rem;
          color: rgba(148, 163, 184, 0.6);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}
