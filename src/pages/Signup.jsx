import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async () => {
    if (!username || !email || !password) {
      Swal.fire("Missing fields", "Please fill in all required fields", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await API.post("/auth/register", {
        username,
        email,
        password,
        avatar,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userId", res.data.user.id);

      Swal.fire({
        icon: "success",
        title: "Signup Successful! 🎉",
        text: "Welcome aboard!",
        timer: 2000,
        showConfirmButton: false,
      });

      navigate("/feed");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.msg || "Signup failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center vh-100"
      style={{
        background: "linear-gradient(135deg, #fdfbfb, #ebedee, #e0f7fa, #ffe0f0)",
      }}
    >
      <div
        className="card shadow-lg p-4"
        style={{
          width: "420px",
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(20px)",
          borderRadius: "20px",
          border: "1px solid rgba(200, 200, 200, 0.3)",
        }}
      >
        <h3 className="text-center mb-4 fw-bold text-dark">Create Account ✨</h3>

        <input
          type="text"
          className="form-control mb-3"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ borderRadius: "12px", border: "1px solid #ddd" }}
        />

        <input
          type="email"
          className="form-control mb-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ borderRadius: "12px", border: "1px solid #ddd" }}
        />

        <input
          type="password"
          className="form-control mb-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ borderRadius: "12px", border: "1px solid #ddd" }}
        />

        <input
          type="text"
          className="form-control mb-4"
          placeholder="Avatar URL (optional)"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          style={{ borderRadius: "12px", border: "1px solid #ddd" }}
        />

        <button
          className="btn w-100 mb-3 fw-bold text-white"
          onClick={handleSignup}
          disabled={loading}
          style={{
            background: "linear-gradient(135deg, #ff9966, #ff5e62)",
            border: "none",
            borderRadius: "12px",
            padding: "12px",
            transition: "transform 0.2s ease, opacity 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.target.style.transform = "scale(1.03)";
            e.target.style.opacity = "0.95";
          }}
          onMouseOut={(e) => {
            e.target.style.transform = "scale(1)";
            e.target.style.opacity = "1";
          }}
        >
          {loading ? (
            <span
              className="spinner-border spinner-border-sm me-2"
              role="status"
            />
          ) : (
            "Sign Up"
          )}
        </button>

        <p className="text-center mb-0 text-dark">
          Already have an account?{" "}
          <a href="/login" className="text-primary fw-bold">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
