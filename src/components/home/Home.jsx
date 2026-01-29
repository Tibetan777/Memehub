import { useState, useEffect } from 'react';
import './Home.css';

export default function Home({ user, onLogout }) {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Upload States
  const [showUploadModal, setShowUploadModal] = useState(false); // ควบคุมการเปิดปิด Modal อัพโหลด
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); // ไว้โชว์รูปตัวอย่าง
  const [category, setCategory] = useState('Funny');

  // Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMeme, setSelectedMeme] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Pagination States
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const API = '/api';

  useEffect(() => {
    loadMemes(1, ''); // โหลดครั้งแรก
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API}/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const profile = await res.json();
        setIsAdmin(profile.role === 'admin');
      }
    } catch (err) { }
  };

  // 🔥 ฟังก์ชันโหลด (รองรับ Search)
  const loadMemes = async (pageNum, search = searchTerm) => {
    try {
      setLoading(true);
      // ส่ง query param: page, limit, search
      const res = await fetch(`${API}/memes?page=${pageNum}&limit=20&search=${encodeURIComponent(search)}`);
      const responseData = await res.json();
      const newMemes = responseData.data || [];
      if (pageNum === 1) {
        setMemes(newMemes);
      } else {
        setMemes(prev => [...prev, ...newMemes]);
      }

      if (newMemes.length < 20) setHasMore(false);
      else setHasMore(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันกดค้นหา
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setHasMore(true);
    loadMemes(1, searchTerm);
  };

  // จัดการเลือกไฟล์และทำ Preview
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile)); // สร้าง URL จำลองเพื่อโชว์รูป
    }
  };

  // Upload new meme
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title || !file) {
      alert('กรุณาใส่ชื่อและเลือกรูปภาพ');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64Data = event.target.result;
        // 🔥 แก้ URL ให้ถูก (ลบ /upload ออก)
        const res = await fetch(`${API}/memes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ title, description, image: base64Data, category })
        });

        const data = await res.json();
        if (res.ok) {
          // Reset Form
          setTitle('');
          setDescription('');
          setFile(null);
          setPreviewUrl(null);
          setShowUploadModal(false); // ปิด Modal
          alert('อัพโหลดเรียบร้อย!');
          // โหลดหน้าแรกใหม่
          setPage(1);
          setSearchTerm('');
          loadMemes(1, '');
        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLike = async (memeId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login to like');
      return;
    }
    try {
      const res = await fetch(`${API}/memes/${memeId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMemes(memes.map(m => m.id === memeId ? { ...m, likes: m.likes + 1 } : m));
        if (selectedMeme && selectedMeme.id === memeId) {
          setSelectedMeme({ ...selectedMeme, likes: selectedMeme.likes + 1 });
        }
      }
    } catch (err) {}
  };

  const handleDeleteMeme = async (memeId) => {
    if (!window.confirm('Delete this meme?')) return;
    try {
      const res = await fetch(`${API}/memes/${memeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        alert('Deleted');
        setPage(1);
        loadMemes(1, searchTerm);
        setSelectedMeme(null);
      }
    } catch (err) {}
  };

  const handleDownload = async (meme) => {
    try {
      // แก้ให้เรียกไปที่ route image โดยตรง
      const imageUrl = `${API}/memes/${meme.id}/image`;
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meme-${meme.id}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download Error');
    }
  };

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="navbar-content">
          <h1 className="navbar-logo" onClick={() => {
            setSearchTerm('');
            loadMemes(1, '');
          }} style={{cursor: 'pointer'}}>Meme Hub</h1>
          {/* ช่องค้นหา */}
          <form className="search-bar" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="ค้นหามีม..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit">🔍</button>
          </form>

          <div className="navbar-menu">
            <span className="user-name">{user?.name}</span>
            {/* ปุ่มเปิด Modal Upload */}
            <button className="upload-btn-nav" onClick={() => setShowUploadModal(true)}>
              + Upload
            </button>
            <button className="logout-btn" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="home-content">
        <div className="memes-header">
          {searchTerm ? <h2>Results for "{searchTerm}"</h2> : <h2>Latest Memes</h2>}
        </div>

        {/* Gallery Grid */}
        <div className="memes-grid">
          {memes.map(meme => (
            <div key={meme.id} className="meme-card">
              <div className="meme-image-wrapper" onClick={() => setSelectedMeme(meme)}>
                <img
                  src={`http://localhost:3000/api/memes/${meme.id}/image`}
                  alt={meme.title}
                  className="meme-image"
                  loading="lazy"
                  onError={(e) => e.target.src = 'https://via.placeholder.com/300?text=Error'}
                />
              </div>
              <div className="meme-info">
                <h3>{meme.title}</h3>
                <div className="meme-actions">
                  <span className="meme-category">{meme.category}</span>
                  <span className="meme-likes">❤️ {meme.likes}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        {loading && <div className="loading-text">Loading...</div>}
        {!loading && hasMore && (
          <button className="load-more-btn" onClick={() => {
            const nextPage = page + 1;
            setPage(nextPage);
            loadMemes(nextPage, searchTerm);
          }}>
            Load More
          </button>
        )}
      </div>

      {/* --- Modal Upload (เด้งขึ้นมาสวยๆ) --- */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            <h2>Create New Meme</h2>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="ตั้งชื่อมีมตลกๆ..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength="100"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Funny</option>
                  <option>Relatable</option>
                  <option>Dark Humor</option>
                  <option>Anime</option>
                  <option>Work Life</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="upload-area">
                <input type="file" id="file-upload" accept="image/*" onChange={handleFileChange} hidden />
                <label htmlFor="file-upload" className="upload-placeholder">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="upload-preview" />
                  ) : (
                    <span>Click to select Image</span>
                  )}
                </label>
              </div>

              <button type="submit" className="submit-btn" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Post Meme'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal View Meme (อันเดิม) --- */}
      {selectedMeme && (
        <div className="modal-overlay" onClick={() => setSelectedMeme(null)}>
          <div className="modal-content view-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMeme(null)}>×</button>
            <div className="modal-body">
              <div className="modal-img-container">
                <img
                  src={`http://localhost:3000/api/memes/${selectedMeme.id}/image`}
                  alt={selectedMeme.title}
                />
              </div>
              <div className="modal-details">
                <h2>{selectedMeme.title}</h2>
                <p className="meta">By {selectedMeme.uploader} • {selectedMeme.category}</p>
                <div className="stats">
                  <span>❤️ {selectedMeme.likes} Likes</span>
                </div>
                <div className="action-buttons">
                  <button onClick={() => handleLike(selectedMeme.id)} className="like-btn">Like</button>
                  <button onClick={() => handleDownload(selectedMeme)} className="dl-btn">Download</button>
                  {isAdmin && (
                    <button onClick={() => { handleDeleteMeme(selectedMeme.id); setSelectedMeme(null); }} className="del-btn">Delete</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}