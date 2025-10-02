// contexts/UserContext.jsx
import React, { createContext, useEffect, useState } from "react";
import API from "../services/api";

export const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // keep user in localStorage and keep token sync
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("userId", user.id);
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("userId");
    }
  }, [user]);

  // Optionally: fetch latest user on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const fetchMe = async () => {
      try {
        setLoading(true);
        const res = await API.get("/auth/me");
        setUser({
          id: res.data._id,
          username: res.data.username,
          email: res.data.email,
          avatar: res.data.avatar || "",
          bio: res.data.bio || "",
        });
      } catch (err) {
        console.warn("Could not fetch /auth/me", err);
        // invalid token? clear
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}
