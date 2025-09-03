// src/pages/Login.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    // ✅ For now, skip authentication
    navigate("/admin-dashboard");
  };

  return (
    <div className="auth-page">
      <div className="auth-box glass-panel">
        {/* Close goes back to home */}
        <button className="auth-close" onClick={() => navigate("/")}>✖</button>

        <h2>Welcome to LakeView PH</h2>
        <div className="auth-logo">
          <img src="/logo.png" alt="LakeView Logo" />
        </div>

        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" />
          <input type="password" placeholder="Password" />

          <p className="auth-forgot">Forgot Password?</p>

          <button type="submit" className="auth-btn">LOG IN</button>
        </form>

        <p className="auth-switch">
          Don’t have an account?{" "}
          <Link to="/register" className="auth-link">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
