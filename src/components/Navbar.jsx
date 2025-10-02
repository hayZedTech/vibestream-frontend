import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../services/api";
import Collapse from "bootstrap/js/dist/collapse";

export default function Navbar({ token, currentUserId, setToken, setCurrentUserId }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (currentUserId && token) {
      const fetchUser = async () => {
        try {
          const res = await API.get(`/users/${currentUserId}`);
          setUsername(res.data.username);
        } catch (err) {
          console.error("Failed to fetch user:", err);
        }
      };
      fetchUser();
    }
  }, [currentUserId, token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    setToken(null);
    setCurrentUserId(null);
    closeMenu(); // close menu when logging out
    navigate("/login");
  };

  // Close Bootstrap navbar collapse
  const closeMenu = () => {
    const nav = document.getElementById("navbarNav");
    if (nav) {
      const bsCollapse = Collapse.getInstance(nav) || new Collapse(nav, { toggle: false });
      bsCollapse.hide();
    }
  };

  // Toggle Bootstrap navbar collapse
  const toggleMenu = () => {
    const nav = document.getElementById("navbarNav");
    if (nav) {
      const bsCollapse = Collapse.getInstance(nav) || new Collapse(nav, { toggle: false });
      if (nav.classList.contains("show")) {
        bsCollapse.hide();
      } else {
        bsCollapse.show();
      }
    }
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-light bg-light fixed-top shadow-sm">
        <div className="container">
          {/* Brand + Username */}
          <div className="d-flex align-items-center">
            <Link
              className="navbar-brand fw-bold me-3"
              to={token ? "/feed" : "/login"}
              onClick={closeMenu}
            >
              VibeStream
            </Link>
            {token && (
              <span className="navbar-text text-muted">
                Hi, <strong>{username || "Loading..."}</strong>
              </span>
            )}
          </div>

          {/* Toggle button for mobile */}
          <button
            className="navbar-toggler"
            type="button"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
            onClick={toggleMenu}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Navbar Links */}
          <div className="collapse navbar-collapse" id="navbarNav">
            {token ? (
              <ul className="navbar-nav ms-auto align-items-lg-center">
                <li className="nav-item mb-2 mb-lg-0 me-lg-3">
                  <Link
                    className="nav-link border border-info rounded px-3 py-2 d-inline-block"
                    to="/feed"
                    onClick={closeMenu}
                  >
                    Feed
                  </Link>
                </li>
                <li className="nav-item mb-2 mb-lg-0 me-lg-3">
                  <Link
                    className="nav-link border border-warning rounded px-3 py-2 d-inline-block"
                    to="/search"
                    onClick={closeMenu}
                  >
                    Search Users
                  </Link>
                </li>
                <li className="nav-item mb-2 mb-lg-0 me-lg-3">
                  <Link
                    className="nav-link border border-success rounded px-3 py-2 d-inline-block"
                    to={`/profile/${currentUserId}`}
                    onClick={closeMenu}
                  >
                    My Profile
                  </Link>
                </li>
                <li className="nav-item mb-2 mb-lg-0">
                  <button
                    className="btn btn-outline-danger border border-danger rounded px-3 py-2 d-inline-block"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </li>
              </ul>
            ) : (
              <ul className="navbar-nav ms-auto align-items-lg-center">
                <li className="nav-item mb-2 mb-lg-0 me-lg-3">
                  <Link
                    className="btn btn-outline-primary border rounded px-3 py-2 d-inline-block"
                    to="/login"
                    onClick={closeMenu}
                  >
                    Login
                  </Link>
                </li>
                <li className="nav-item mb-2 mb-lg-0">
                  <Link
                    className="btn btn-success border rounded px-3 py-2 d-inline-block"
                    to="/signup"
                    onClick={closeMenu}
                  >
                    Signup
                  </Link>
                </li>
              </ul>
            )}
          </div>
        </div>
      </nav>

      {/* Spacer to prevent overlap with content */}
      <div style={{ paddingTop: "70px" }}></div>
    </>
  );
}
