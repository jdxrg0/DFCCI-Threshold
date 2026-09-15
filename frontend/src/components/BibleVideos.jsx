import { useState, useEffect, useRef } from 'react';
import { Heart, Trash, Play, Pause, Volume2, VolumeX, Plus, X, UploadCloud, Film } from 'lucide-react';
import * as bibleVideos from '../services/bibleVideos';
import { useAuth } from '../context/AuthContext';

const BibleVideos = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Volume state across all videos
  const [isMuted, setIsMuted] = useState(true);
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [videoFile, setVideoFile] = useState(null);

  const containerRef = useRef(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bibleVideos.listVideos();
      setVideos(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load reels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchVideos());
    return () => clearTimeout(timer);
  }, []);

  // Intersection Observer to autoplay active video card
  useEffect(() => {
    if (videos.length === 0) return;

    const observerOptions = {
      root: containerRef.current,
      rootMargin: '0px',
      threshold: 0.6,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const videoElement = entry.target.querySelector('video');
        if (!videoElement) return;

        if (entry.isIntersecting) {
          videoElement.play().catch((err) => {
            // Autoplay might be blocked by browsers if not muted
            console.log('Autoplay blocked: ', err);
          });
        } else {
          videoElement.pause();
          videoElement.currentTime = 0; // Reset video to start
        }
      });
    }, observerOptions);

    const videoCards = containerRef.current?.querySelectorAll('.video-snap-card');
    videoCards?.forEach((card) => observer.observe(card));

    return () => {
      videoCards?.forEach((card) => observer.unobserve(card));
    };
  }, [videos]);

  const handleLike = async (id) => {
    try {
      const data = await bibleVideos.likeVideo(id);
      setVideos((prev) =>
        prev.map((video) =>
          video._id === id
            ? { ...video, likes: data.likes }
            : video
        )
      );
    } catch (err) {
      console.error('Failed to toggle like', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this reel?')) return;
    try {
      await bibleVideos.deleteVideo(id);
      setVideos((prev) => prev.filter((v) => v._id !== id));
    } catch (err) {
      console.error('Failed to delete video', err);
      alert('Failed to delete video.');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      alert('Please select a video file.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('caption', caption);
    formData.append('video', videoFile);

    try {
      const data = await bibleVideos.uploadVideo(formData);
      setVideos((prev) => [data, ...prev]);
      setShowUploadModal(false);
      setTitle('');
      setCaption('');
      setVideoFile(null);
    } catch (err) {
      console.error('Failed to upload video', err);
      alert('Failed to upload video. Ensure you are an Admin and file size is valid.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', position: 'relative' }}>
      
      {/* Top Banner and Upload Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)' }}>
            Why read the Bible?
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Short, inspiring thoughts from leadership.
          </span>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.9rem',
              fontSize: '0.75rem',
              fontWeight: '800',
              borderRadius: '999px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #000))',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 3px 8px color-mix(in srgb, var(--primary) 25%, transparent)',
              transition: 'transform 0.1s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Reel
          </button>
        )}
      </div>

      {error && (
        <p style={{ color: '#EF4444', textAlign: 'center', fontSize: '0.85rem', margin: '1rem 0' }}>
          {error}
        </p>
      )}

      {/* Main Reels Snap Container */}
      <div
        ref={containerRef}
        className="reels-container"
        style={{
          width: '100%',
          maxWidth: '430px',
          height: '630px',
          margin: '0 auto',
          backgroundColor: '#000',
          borderRadius: '20px',
          overflowY: 'auto',
          scrollSnapType: 'y mandatory',
          position: 'relative',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          border: '1px solid var(--border-color)',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', gap: '0.75rem' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#9CA3AF' }}>Loading Reels...</span>
          </div>
        ) : videos.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF', padding: '2rem', textAlign: 'center', gap: '0.75rem' }}>
            <Film size={40} style={{ color: '#4B5563' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#E5E7EB' }}>No videos posted yet</span>
            <span style={{ fontSize: '0.75rem' }}>Check back later for inspiring devotions!</span>
          </div>
        ) : (
          videos.map((video) => (
            <VideoCard
              key={video._id}
              video={video}
              userId={user?._id}
              isAdmin={isAdmin}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onLike={() => handleLike(video._id)}
              onDelete={() => handleDelete(video._id)}
            />
          ))
        )}
      </div>

      {/* Upload Reel Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem',
        }} onClick={() => !uploading && setShowUploadModal(false)}>
          <div style={{
            width: '100%',
            maxWidth: '450px',
            backgroundColor: 'var(--surface)',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, var(--primary), #8B5CF6)' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Film size={18} color="var(--primary)" /> Add Video Reel
              </h3>
              <button disabled={uploading} onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Reel Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Why Bible reading builds character"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  style={{ fontWeight: '600' }}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="form-label">Caption / Description</label>
                <textarea
                  placeholder="Tell us about the video..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="form-input"
                  rows={3}
                  style={{ resize: 'none', fontFamily: 'inherit', fontSize: '0.85rem' }}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="form-label">Video File *</label>
                <div style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  backgroundColor: 'var(--bg-color)',
                  position: 'relative',
                }}>
                  <input
                    type="file"
                    accept="video/*"
                    required
                    onChange={(e) => setVideoFile(e.target.files[0])}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      width: '100%',
                    }}
                    disabled={uploading}
                  />
                  <UploadCloud size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    {videoFile ? videoFile.name : 'Click to browse video file'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    MP4, WebM formats preferred.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                  className="btn btn-secondary"
                  style={{ borderRadius: '999px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn btn-primary"
                  style={{
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #000))',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {uploading ? (
                    <>
                      <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                      Uploading...
                    </>
                  ) : 'Upload Reel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Embedded CSS animations for loading spinners */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ── Vertical Snapping Video Card ─────────────────────────────────────────────
const VideoCard = ({ video, userId, isAdmin, isMuted, onToggleMute, onLike, onDelete }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [showPlayStateFlash, setShowPlayStateFlash] = useState(null); // 'play' | 'pause'

  const isLiked = video.likes?.includes(userId);

  const handleVideoClick = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerStateFlash('pause');
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      triggerStateFlash('play');
    }
  };

  const triggerStateFlash = (state) => {
    setShowPlayStateFlash(state);
    setTimeout(() => {
      setShowPlayStateFlash(null);
    }, 500);
  };

  const handleDoubleTap = () => {
    if (!isLiked) {
      onLike();
    }
    setShowHeartPop(true);
    setTimeout(() => setShowHeartPop(false), 800);
  };

  // Keep track of internal playing state
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);

    return () => {
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('pause', handlePause);
    };
  }, []);

  return (
    <div
      className="video-snap-card"
      style={{
        width: '100%',
        height: '100%',
        scrollSnapAlign: 'start',
        position: 'relative',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* HTML5 Video Player */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        loop
        playsInline
        muted={isMuted}
        onClick={handleVideoClick}
        onDoubleClick={handleDoubleTap}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          cursor: 'pointer',
        }}
      />

      {/* Ambient Gradient Overlay for text readability */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Top Overlay for Mute & Info */}
      <div style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        right: '1rem',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        zIndex: 5,
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Large double-click Heart Pop Animation */}
      {showHeartPop && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 10,
          animation: 'heartBeat 0.8s ease-out forwards',
        }}>
          <Heart size={80} fill="#EF4444" color="#EF4444" />
        </div>
      )}

      {/* Play/Pause state Flash Animation */}
      {showPlayStateFlash && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          zIndex: 9,
          animation: 'flashFade 0.5s ease-out forwards',
        }}>
          {showPlayStateFlash === 'play' ? <Play size={28} fill="#fff" /> : <Pause size={28} fill="#fff" />}
        </div>
      )}

      {/* Right Side Interaction Panel */}
      <div style={{
        position: 'absolute',
        right: '12px',
        bottom: '80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem',
        zIndex: 5,
      }}>
        {/* Like Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
            style={{
              background: isLiked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.5)',
              border: 'none',
              borderRadius: '50%',
              width: '45px',
              height: '45px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLiked ? '#EF4444' : '#fff',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              transition: 'transform 0.15s ease, background-color 0.2s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.85)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Heart size={22} fill={isLiked ? '#EF4444' : 'none'} strokeWidth={2.5} />
          </button>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {video.likes?.length || 0}
          </span>
        </div>

        {/* Delete button (Admin Only) */}
        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.25)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F87171',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.85)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Trash size={18} />
          </button>
        )}
      </div>

      {/* Bottom Text Description Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '16px',
        right: '70px',
        color: '#fff',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: '900',
            textTransform: 'uppercase',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '4px',
            letterSpacing: '0.5px',
          }}>
            Leader Note
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#D1D5DB' }}>
            @{video.postedBy?.displayName || 'Leader'}
          </span>
        </div>

        <h4 style={{
          margin: '2px 0 0',
          fontSize: '0.96rem',
          fontWeight: '900',
          lineHeight: '1.25',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}>
          {video.title}
        </h4>

        {video.caption && (
          <p style={{
            margin: '2px 0 0',
            fontSize: '0.8rem',
            color: '#E5E7EB',
            lineHeight: '1.35',
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}>
            {video.caption}
          </p>
        )}
      </div>

      {/* Embedded Animations */}
      <style>{`
        @keyframes heartBeat {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.9; }
          80% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        @keyframes flashFade {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default BibleVideos;
