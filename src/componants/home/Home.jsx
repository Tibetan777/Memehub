import { useState, useEffect } from 'react';
import './Home.css';

export default function Home({ user, onLogout }) {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('Funny');
  const [selectedMeme, setSelectedMeme] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const API = '/api';

  useEffect(() => {
    loadMemes();
    checkAdminStatus();
  }, []);

  // Check if logged-in user is admin
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
    } catch (err) {
      // Admin check failed silently
    }
  };

  // Load memes from server
  const loadMemes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/memes?t=${Date.now()}`);
      const data = await res.json();
      setMemes(Array.isArray(data) ? data : []);
    } catch (err) {
      setMemes([]);
    } finally {
      setLoading(false);
    }
  };

  // Upload new meme
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title || !file) {
      alert('Please enter title and select image');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const base64Data = event.target.result;
        if (!base64Data || base64Data.length < 100) {
          alert('Invalid image');
          return;
        }

        const res = await fetch(`${API}/memes/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ title, description, image: base64Data, category })
        });

        const data = await res.json();
        if (res.ok) {
          setTitle('');
          setDescription('');
          setFile(null);
          alert('Upload successful');
          setTimeout(loadMemes, 500);
        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        setUploading(false);
      }
    };

    reader.onerror = () => {
      alert('Failed to read file');
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  // Like a meme (one per user) - update state without refresh
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
        // Update state instantly without page refresh
        setMemes(memes.map(m => m.id === memeId ? { ...m, likes: m.likes + 1 } : m));
        if (selectedMeme && selectedMeme.id === memeId) {
          setSelectedMeme({ ...selectedMeme, likes: selectedMeme.likes + 1 });
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Like failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Delete meme (admin only)
  const handleDeleteMeme = async (memeId) => {
    if (!window.confirm('Delete this meme?')) return;

    try {
      const res = await fetch(`${API}/memes/${memeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.ok) {
        alert('Meme deleted');
        loadMemes();
        setSelectedMeme(null);
      } else {
        alert('Delete failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Download meme image
  const handleDownload = async (meme) => {
    try {
      const res = await fetch(`${API}/memes/${meme.id}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${meme.title}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed');
    }
  };

  return (
    <div className="home-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-content">
          <h1 className="navbar-logo">Meme Hub</h1>
          <div className="navbar-menu">
            <span>{user?.name}</span>
            <button onClick={onLogout}>Logout</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="home-content">
        {/* Upload Section */}
        <div className="upload-section">
          <h2>Upload Meme</h2>
          <form onSubmit={handleUpload}>
            <input
              type="text"
              placeholder="Meme title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>Funny</option>
              <option>Relatable</option>
              <option>Dark Humor</option>
              <option>Anime</option>
              <option>Other</option>
            </select>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
            <button type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading && <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading memes...</div>}

        {/* Memes Gallery */}
        {!loading && (
          <>
            <div className="memes-header">
              <h2>Memes Gallery ({memes.length})</h2>
            </div>

            <div className="memes-grid">
              {memes.map(meme => (
                <div key={meme.id} className="meme-card">
                  <div className="meme-image-wrapper" onClick={() => setSelectedMeme(meme)}>
                    <img
                      src={`${API}/memes/${meme.id}/image`}
                      alt={meme.title}
                      className="meme-image"
                      onError={(e) => e.target.src = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'}
                    />
                  </div>
                  <div className="meme-info">
                    <h3>{meme.title}</h3>
                    <p style={{ fontSize: '13px', color: '#666', margin: '5px 0' }}>
                      Upload by: {meme.uploadedBy}
                    </p>
                    <p style={{ fontSize: '12px', color: '#999', margin: '5px 0' }}>
                      {new Date(meme.uploadedAt).toLocaleDateString()}
                    </p>
                    <div className="meme-actions">
                      <span className="meme-category">{meme.category}</span>
                      <span className="meme-likes">Likes: {meme.likes}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal - Meme Details */}
      {selectedMeme && (
        <div className="modal-overlay" onClick={() => setSelectedMeme(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMeme(null)}>×</button>
            <img
              src={`${API}/memes/${selectedMeme.id}/image`}
              alt={selectedMeme.title}
              className="modal-image"
            />
            <div className="modal-info">
              <h2>{selectedMeme.title}</h2>
              <p>{selectedMeme.description}</p>
              <p><strong>Upload by:</strong> {selectedMeme.uploadedBy}</p>
              <p><strong>Date:</strong> {new Date(selectedMeme.uploadedAt).toLocaleString()}</p>
              <p><strong>Category:</strong> {selectedMeme.category}</p>
              <p><strong>Likes:</strong> {selectedMeme.likes}</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => handleLike(selectedMeme.id)} className="action-btn">
                  Like
                </button>
                <button onClick={() => handleDownload(selectedMeme)} className="action-btn">
                  Download
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      handleDeleteMeme(selectedMeme.id);
                      setSelectedMeme(null);
                    }}
                    className="action-btn delete-btn"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
