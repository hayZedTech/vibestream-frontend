import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";
import Swal from "sweetalert2";

export default function Profile({ currentUserId }) {
  const { id } = useParams(); // user id from URL
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false); // spinner state

  // Fetch user profile
  useEffect(() => {
    const fetchUser = async () => {
      const res = await API.get(`/users/${id}`);
      setUser(res.data);
      setPreview(res.data.avatar);
      setIsFollowing(res.data.followers.some((f) => f._id === currentUserId));
    };
    fetchUser();
  }, [id, currentUserId]);

  // Handle avatar change with validation
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ✅ Check file size (3MB max)
    const maxSize = 3 * 1024 * 1024; // 3MB in bytes
    if (file.size > maxSize) {
      Swal.fire({
        icon: "warning",
        title: "File too large",
        text: "Please upload an image smaller than 3MB.",
      });
      e.target.value = null; // reset input
      return;
    }

    // ✅ Check file type (now includes WebP)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      Swal.fire({
        icon: "error",
        title: "Unsupported file format",
        text: "Only JPG, PNG, GIF, and WebP images are allowed.",
      });
      e.target.value = null; // reset input
      return;
    }

    // ✅ Passed validation
    setAvatar(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!avatar) return;
    try {
      setLoading(true); // show spinner
      const formData = new FormData();
      formData.append("avatar", avatar);

      const res = await API.put("/users/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPreview(res.data.avatar);

      // ✅ SweetAlert Toast for success
      Swal.fire({
        icon: "success",
        title: "Avatar updated!",
        toast: true,
        position: "center",
        showConfirmButton: true,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Failed to update avatar",
        text: err.response?.data?.msg || "Something went wrong",
        toast: true,
        position: "center",
        showConfirmButton: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Follow / unfollow
  const handleFollow = async () => {
    const res = await API.put(`/users/${id}/follow`);
    setIsFollowing(!isFollowing);
    setUser((prev) => ({
      ...prev,
      followers: res.data.followers,
      following: prev.following,
    }));
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="container mt-4">
      <h2>{user.username}</h2>

      {/* Avatar */}
      <img
        src={preview || "/default-avatar.png"}
        alt="Avatar"
        width={120}
        height={120}
        className="mb-2 rounded-circle"
      />
      {currentUserId === id && (
        <div>
          {/* ✅ Updated accept attribute to show only supported formats */}
          <input
            type="file"
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.gif,.webp"
          />

          {/* Upload Button */}
          <button
            className="btn btn-sm btn-primary mt-2"
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                ></span>
                Uploading...
              </>
            ) : (
              "Upload Avatar"
            )}
          </button>
        </div>
      )}

      {/* Follow / Unfollow */}
      {currentUserId !== id && (
        <div>
          <button
            className="btn btn-sm btn-success mt-2"
            onClick={handleFollow}
          >
            {isFollowing ? "Unfollow" : "Follow"}
          </button>
        </div>
      )}

      {/* Followers / Following counts */}
      <div className="mt-3">
        <strong>Followers:</strong> {user.followers.length} <br />
        <strong>Following:</strong> {user.following.length}
      </div>
    </div>
  );
}
