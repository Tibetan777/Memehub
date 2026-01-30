import { useState, useEffect } from "react";
import "./Login.css";

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // 🔥 เพิ่มตัวแปร Confirm Password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

  const API = "/api";

  // จัดการ Theme (เหมือนหน้า Home)
  useEffect(() => {
    if (darkMode) document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("theme", newMode ? "dark" : "light");
      return newMode;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // เช็คว่า Confirm Password ตรงกันไหม (เฉพาะตอนสมัคร)
    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isRegister ? "/register" : "/login";
      const body = isRegister ? { name, email, password } : { email, password };

      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");

      if (isRegister) {
        alert("Register Successful! Please Login.");
        setIsRegister(false);
        setName("");
        setPassword("");
        setConfirmPassword("");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setTimeout(() => onLoginSuccess(data.user), 500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* ปุ่มเปลี่ยน Theme มุมขวาบน */}
      <button className="theme-toggle-login" onClick={toggleTheme}>
        {darkMode ? "☀️" : "🌙"}
      </button>

      <div className="login-box">
        <div className="login-header">
          <h1 className="brand-logo">MemeHub</h1>
          <h2>{isRegister ? "Create Account" : "Welcome Back"}</h2>
          <p>{isRegister ? "Join the community" : "Login to continue"}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={isRegister}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* ช่อง Confirm Password (แสดงเฉพาะตอน Register) */}
          {isRegister && (
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={isRegister}
                className={
                  confirmPassword && password !== confirmPassword
                    ? "input-error"
                    : ""
                }
              />
            </div>
          )}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Processing..." : isRegister ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {isRegister
              ? "Already have an account? "
              : "Don't have an account? "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsRegister(!isRegister);
                setError("");
                setName("");
                setEmail("");
                setPassword("");
                setConfirmPassword("");
              }}
            >
              {isRegister ? "Sign In" : "Sign Up"}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
