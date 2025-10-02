import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function SearchUsers() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  const handleChange = async (e) => {
    const q = e.target.value;
    setQuery(q);

    if (!q.trim()) {
      setResults([]);
      return;
    }

    try {
      const res = await API.get(`/users/search?q=${q}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setResults(res.data);
    } catch (err) {
      console.error("Search error:", err.response?.data || err.message);
      setResults([]);
    }
  };

  const goToProfile = (userId) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="container mt-4" style={{ maxWidth: "600px" }}>
      <h2 className="mb-3">🔎 Search Users</h2>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Search by username..."
        className="form-control mb-3"
      />

      {results.length === 0 && query && (
        <p className="text-muted">No users found.</p>
      )}

      <ul className="list-group">
        {results.map((user) => (
          <li
            key={user._id}
            className="list-group-item d-flex align-items-center"
            style={{ cursor: "pointer" }}
            onClick={() => goToProfile(user._id)}
          >
            <img
              src={user.avatar || "/default-avatar.png"}
              alt="avatar"
              width={40}
              height={40}
              className="rounded-circle me-2"
              style={{ objectFit: "cover" }}
            />
            {user.username}
          </li>
        ))}
      </ul>
    </div>
  );
}
