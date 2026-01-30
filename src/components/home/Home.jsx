import { useState, useEffect, useRef, useCallback } from "react";
import "./Home.css";

// SVG Icons
const HeartIcon = ({ filled }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={filled ? "#ef4444" : "none"}
    stroke={filled ? "#ef4444" : "currentColor"}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const DownloadIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

export default function Home({ user, onLogout }) {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [category, setCategory] = useState("Funny");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMeme, setSelectedMeme] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

  // Infinite Scroll Observer
  const observer = useRef();
  const lastMemeElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  const API = "/api";

  useEffect(() => {
    // Load initial data
    loadMemes(1, searchTerm, true);

    if (darkMode) document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  }, [darkMode]);

  // Effect for Infinite Scroll (Load when page changes)
  useEffect(() => {
    if (page > 1) {
      loadMemes(page, searchTerm, false);
    }
  }, [page]);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("theme", newMode ? "dark" : "light");
      return newMode;
    });
  };

  const loadMemes = async (pageNum, search, isNewSearch) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(
        `${API}/memes?page=${pageNum}&limit=12&search=${encodeURIComponent(search)}&t=${Date.now()}`,
        { headers },
      );
      const responseData = await res.json();
      const newMemes = responseData.data || [];

      if (isNewSearch) {
        setMemes(newMemes);
      } else {
        setMemes((prev) => [...prev, ...newMemes]);
      }

      setHasMore(newMemes.length >= 12);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadMemes(1, searchTerm, true);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title || !file) return alert("Please upload an image.");
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const res = await fetch(`${API}/memes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            title,
            description,
            image: event.target.result,
            category,
          }),
        });
        if (res.ok) {
          setTitle("");
          setDescription("");
          setFile(null);
          setPreviewUrl(null);
          setShowUploadModal(false);
          setPage(1);
          setSearchTerm("");
          loadMemes(1, "", true); // Reload fresh
        } else {
          alert("Upload failed");
        }
      } catch (err) {
        alert("Error: " + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLike = async (memeId) => {
    const token = localStorage.getItem("token");
    if (!token) return alert("Please login to like.");

    try {
      const res = await fetch(`${API}/memes/${memeId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setMemes((prev) =>
          prev.map((m) => {
            if (m.id === memeId) {
              const isLikedNow = data.status === "liked";
              const newLikes = isLikedNow
                ? m.likes + 1
                : Math.max(0, m.likes - 1);

              if (selectedMeme && selectedMeme.id === memeId) {
                setSelectedMeme((curr) => ({
                  ...curr,
                  likes: newLikes,
                  isLiked: isLikedNow,
                }));
              }
              return { ...m, likes: newLikes, isLiked: isLikedNow };
            }
            return m;
          }),
        );
      }
    } catch (err) {}
  };

  const handleDeleteMeme = async (memeId) => {
    if (!window.confirm("Delete this post permanently?")) return;
    try {
      const res = await fetch(`${API}/memes/${memeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        setPage(1);
        loadMemes(1, searchTerm, true);
        setSelectedMeme(null);
      } else {
        alert("Cannot delete: Unauthorized");
      }
    } catch (err) {}
  };

  const handleDownload = async (meme) => {
    try {
      const res = await fetch(`/api/memes/${meme.id}/image`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `meme-${meme.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Download Error");
    }
  };

  // Hide broken images
  const handleImageError = (e) => {
    e.target.style.display = "none"; // Hide the img element
    // Optional: e.target.src = '/placeholder.png';
  };

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="nav-left">
            <h1
              className="navbar-logo"
              onClick={() => {
                setSearchTerm("");
                loadMemes(1, "", true);
              }}
            >
              MemeHub
            </h1>
            <form className="search-bar" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </form>
          </div>
          <div className="navbar-menu">
            <button className="theme-btn" onClick={toggleTheme}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <span className="user-name">{user?.name}</span>
            <button
              className="upload-btn-nav"
              onClick={() => setShowUploadModal(true)}
            >
              + New
            </button>
            <button className="logout-btn" onClick={onLogout}>
              Exit
            </button>
          </div>
        </div>
      </nav>

      <div className="home-content">
        <div className="memes-header">
          <h2>{searchTerm ? `Results: "${searchTerm}"` : "Latest Memes"}</h2>
        </div>
        <div className="memes-grid">
          {memes.map((meme, index) => {
            if (memes.length === index + 1) {
              return (
                <div
                  ref={lastMemeElementRef}
                  key={meme.id}
                  className="meme-card"
                  onClick={() => setSelectedMeme(meme)}
                >
                  <div className="meme-image-wrapper">
                    <img
                      src={`/api/memes/${meme.id}/image`}
                      alt={meme.title}
                      className="meme-image"
                      loading="lazy"
                      onError={handleImageError}
                    />
                  </div>
                  <div className="meme-info">
                    <h3>{meme.title}</h3>
                    <div className="meme-footer">
                      <div className="meme-stats">
                        <HeartIcon filled={meme.isLiked} />{" "}
                        <span>{meme.likes}</span>
                      </div>
                      <span className="meme-cat">{meme.category}</span>
                    </div>
                  </div>
                </div>
              );
            } else {
              return (
                <div
                  key={meme.id}
                  className="meme-card"
                  onClick={() => setSelectedMeme(meme)}
                >
                  <div className="meme-image-wrapper">
                    <img
                      src={`/api/memes/${meme.id}/image`}
                      alt={meme.title}
                      className="meme-image"
                      loading="lazy"
                      onError={handleImageError}
                    />
                  </div>
                  <div className="meme-info">
                    <h3>{meme.title}</h3>
                    <div className="meme-footer">
                      <div className="meme-stats">
                        <HeartIcon filled={meme.isLiked} />{" "}
                        <span>{meme.likes}</span>
                      </div>
                      <span className="meme-cat">{meme.category}</span>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>

        {loading && <div className="loading-spinner">Loading...</div>}
        {!hasMore && memes.length > 0 && (
          <div className="end-text">You've reached the end!</div>
        )}
      </div>

      {showUploadModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="modal-content upload-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-section">
              <h2>Create Post</h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-scroll-area">
              <form onSubmit={handleUpload}>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter title..."
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>Funny</option>
                    <option>Relatable</option>
                    <option>Dark Humor</option>
                    <option>Anime</option>
                    <option>Work Life</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="upload-area">
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    hidden
                  />
                  <label htmlFor="file-upload" className="upload-placeholder">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="upload-preview"
                      />
                    ) : (
                      <span>Click to Upload</span>
                    )}
                  </label>
                </div>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Post"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {selectedMeme && (
        <div className="modal-overlay" onClick={() => setSelectedMeme(null)}>
          <div
            className="modal-content view-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedMeme(null)}
            >
              ×
            </button>
            <div className="modal-body">
              <div className="modal-img-container">
                <img
                  src={`/api/memes/${selectedMeme.id}/image`}
                  alt={selectedMeme.title}
                  onError={handleImageError}
                />
              </div>
              <div className="modal-details">
                <div className="modal-top">
                  <div className="modal-header">
                    <h2>{selectedMeme.title}</h2>
                    <span className="modal-cat">{selectedMeme.category}</span>
                  </div>
                  <div className="meta">Posted by {selectedMeme.uploader}</div>
                </div>

                <div className="modal-actions-area">
                  <div className="stats-large">{selectedMeme.likes} Likes</div>
                  <div className="action-row">
                    <button
                      onClick={() => handleLike(selectedMeme.id)}
                      className={`action-btn like ${selectedMeme.isLiked ? "active" : ""}`}
                    >
                      <HeartIcon filled={selectedMeme.isLiked} />{" "}
                      {selectedMeme.isLiked ? "Liked" : "Like"}
                    </button>
                    <button
                      onClick={() => handleDownload(selectedMeme)}
                      className="action-btn download"
                    >
                      <DownloadIcon /> Save
                    </button>
                    {(user?.role === "admin" ||
                      user?.id === selectedMeme.created_by) && (
                      <button
                        onClick={() => {
                          handleDeleteMeme(selectedMeme.id);
                          setSelectedMeme(null);
                        }}
                        className="action-btn delete"
                      >
                        <TrashIcon /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
