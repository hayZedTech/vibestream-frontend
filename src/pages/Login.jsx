import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

export default function Login({ setToken, setCurrentUserId }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      Swal.fire("Missing fields", "Please enter email and password", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userId", res.data.user.id);

      setToken(res.data.token);
      setCurrentUserId(res.data.user.id);

      navigate("/feed");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.msg || "Login failed", "error");
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
          width: "400px",
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(20px)",
          borderRadius: "20px",
          border: "1px solid rgba(200, 200, 200, 0.3)",
        }}
      >
        <h3 className="text-center mb-4 fw-bold text-dark">Welcome Back 👋</h3>

        <input
          type="email"
          className="form-control mb-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            borderRadius: "12px",
            border: "1px solid #ddd",
          }}
        />

        <input
          type="password"
          className="form-control mb-4"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            borderRadius: "12px",
            border: "1px solid #ddd",
          }}
        />

        <button
          className="btn w-100 mb-3 fw-bold text-white"
          onClick={handleLogin}
          disabled={loading}
          style={{
            background: "linear-gradient(135deg, #6dd5ed, #2193b0)",
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
            "Login"
          )}
        </button>

        <p className="text-center mb-0 text-dark">
          Don’t have an account?{" "}
          <a href="/signup" className="text-primary fw-bold">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
