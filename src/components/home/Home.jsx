import { useState, useEffect, useRef, useCallback } from "react";
import "./Home.css";

// --- Icons ---
const SearchIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ minWidth: "20px" }}
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
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
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
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
const EditIcon = () => (
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
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);
const SettingsIcon = () => (
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
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

export default function Home({ user, onLogout }) {
  const [memes, setMemes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [category, setCategory] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const [selectedMeme, setSelectedMeme] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState("");

  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

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
    fetchCategories();
    loadMemes(1, searchTerm, filterCategory, true);
    if (darkMode) document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  }, [darkMode]);

  useEffect(() => {
    if (page > 1) loadMemes(page, searchTerm, filterCategory, false);
  }, [page]);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("theme", newMode ? "dark" : "light");
      return newMode;
    });
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API}/categories`);
      const data = await res.json();
      setCategories(data);
      if (data.length > 0 && !category) setCategory(data[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMemes = async (pageNum, search, cat, isNewSearch) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const query = `page=${pageNum}&limit=12&search=${encodeURIComponent(search)}&category=${cat}&t=${Date.now()}`;
      const res = await fetch(`${API}/memes?${query}`, { headers });
      const responseData = await res.json();
      const newMemes = responseData.data || [];

      if (isNewSearch) setMemes(newMemes);
      else setMemes((prev) => [...prev, ...newMemes]);

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
    loadMemes(1, searchTerm, filterCategory, true);
  };

  const handleCategoryFilterChange = (e) => {
    const newCat = e.target.value;
    setFilterCategory(newCat);
    setPage(1);
    loadMemes(1, searchTerm, newCat, true);
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
          setFilterCategory("All");
          loadMemes(1, "", "All", true);
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

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      const res = await fetch(`${API}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ name: newCatName }),
      });
      if (res.ok) {
        setNewCatName("");
        fetchCategories();
      } else {
        alert("Category likely exists");
      }
    } catch (err) {
      alert("Error adding category");
    }
  };

  const handleDeleteCategory = async (catName) => {
    if (!window.confirm(`Delete category "${catName}"?`)) return;
    try {
      const res = await fetch(`${API}/categories/${catName}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) fetchCategories();
      else alert("Failed to delete");
    } catch (err) {
      alert("Error deleting");
    }
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

  const handleUpdateCategory = async () => {
    if (!selectedMeme) return;
    try {
      const res = await fetch(`${API}/memes/${selectedMeme.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ category: editCategory }),
      });
      if (res.ok) {
        setSelectedMeme((prev) => ({ ...prev, category: editCategory }));
        setMemes((prev) =>
          prev.map((m) =>
            m.id === selectedMeme.id ? { ...m, category: editCategory } : m,
          ),
        );
        setIsEditing(false);
      } else {
        alert("Update failed");
      }
    } catch (err) {
      alert("Error updating");
    }
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
        loadMemes(1, searchTerm, filterCategory, true);
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

  const openMeme = (meme) => {
    setSelectedMeme(meme);
    setIsEditing(false);
    setEditCategory(meme.category);
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
                setFilterCategory("All");
                loadMemes(1, "", "All", true);
              }}
            >
              MemeHub
            </h1>

            {/* Unified Search Bar */}
            <div className="search-bar-unified">
              <div className="search-icon-box">
                <SearchIcon />
              </div>

              <form
                onSubmit={handleSearch}
                style={{ flex: 1, display: "flex" }}
              >
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </form>

              <div className="search-divider"></div>

              <select
                className="cat-select-unified"
                value={filterCategory}
                onChange={handleCategoryFilterChange}
              >
                <option value="All">All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {user?.role === "admin" && (
                <>
                  <div className="search-divider"></div>
                  <button
                    className="settings-icon-btn"
                    onClick={() => setShowCatManager(true)}
                    title="Manage Categories"
                  >
                    <SettingsIcon />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="navbar-menu">
            <button className="theme-btn" onClick={toggleTheme}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <span className="user-name">{user?.name}</span>
            {/* เปลี่ยนข้อความปุ่มตรงนี้ */}
            <button
              className="upload-btn-nav"
              onClick={() => setShowUploadModal(true)}
            >
              Upload
            </button>
            <button className="logout-btn" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="home-content">
        <div className="memes-header">
          <h2>
            {filterCategory === "All"
              ? "Latest Memes"
              : `${filterCategory} Memes`}{" "}
            {searchTerm && `for "${searchTerm}"`}
          </h2>
        </div>
        <div className="memes-grid">
          {memes.map((meme, index) => {
            const isLast = memes.length === index + 1;
            return (
              <div
                ref={isLast ? lastMemeElementRef : null}
                key={meme.id}
                className="meme-card"
                onClick={() => openMeme(meme)}
              >
                <div className="meme-image-wrapper">
                  <img
                    src={`/api/memes/${meme.id}/image`}
                    alt={meme.title}
                    className="meme-image"
                    loading="lazy"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </div>
                <div className="meme-info">
                  <h3 className="meme-title">{meme.title}</h3>
                  <div className="meme-meta-row">
                    <span className="meme-uploader">by {meme.uploader}</span>
                    <span className="meme-cat-badge">{meme.category}</span>
                  </div>
                  <div className="meme-stats-row">
                    <HeartIcon filled={meme.isLiked} />{" "}
                    <span>{meme.likes}</span>
                  </div>
                </div>
              </div>
            );
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
                    {categories.length === 0 && <option>General</option>}
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
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

      {showCatManager && (
        <div className="modal-overlay" onClick={() => setShowCatManager(false)}>
          <div
            className="modal-content upload-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-section">
              <h2>Manage Categories</h2>
              <button
                className="modal-close-btn"
                onClick={() => setShowCatManager(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-scroll-area">
              <form
                onSubmit={handleAddCategory}
                style={{ display: "flex", gap: "8px", marginBottom: "20px" }}
              >
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New category name..."
                  style={{ flex: 1, padding: "8px" }}
                />
                <button
                  type="submit"
                  className="save-tiny-btn"
                  style={{ fontSize: "1rem" }}
                >
                  Add
                </button>
              </form>
              <div className="cat-list">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span>{cat}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="cancel-tiny-btn"
                      style={{ color: "var(--danger)" }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
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
                  onError={(e) => (e.target.style.display = "none")}
                />
              </div>
              <div className="modal-details">
                <div className="modal-top">
                  <h2 className="modal-title">{selectedMeme.title}</h2>
                  <div className="modal-meta-block">
                    <div className="modal-uploader">
                      Posted by <strong>{selectedMeme.uploader}</strong>
                    </div>
                    <div className="modal-category-row">
                      {isEditing ? (
                        <div className="edit-cat-wrapper">
                          <select
                            className="edit-cat-select"
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          <button
                            className="save-tiny-btn"
                            onClick={handleUpdateCategory}
                          >
                            Save
                          </button>
                          <button
                            className="cancel-tiny-btn"
                            onClick={() => setIsEditing(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="modal-cat-badge">
                            {selectedMeme.category}
                          </span>
                          {(user?.role === "admin" ||
                            user?.id === selectedMeme.created_by) && (
                            <button
                              className="edit-icon-btn"
                              onClick={() => setIsEditing(true)}
                              title="Edit Category"
                            >
                              <EditIcon />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
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
