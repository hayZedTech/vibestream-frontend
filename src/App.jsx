import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import SearchUsers from "./pages/SearchUsers";
import Navbar from "./components/Navbar";

function App() {
  const [token, setToken] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUserId = localStorage.getItem("userId");

    if (storedToken) setToken(storedToken);
    if (storedUserId) setCurrentUserId(storedUserId);
  }, []);

  return (
    <Router>
      <Navbar 
              token={token} 
              currentUserId={currentUserId} 
              setToken={setToken} 
              setCurrentUserId={setCurrentUserId} 
      />

      <Routes>
        <Route
          path="/login"
          element={
            !token ? (
              <Login setToken={setToken} setCurrentUserId={setCurrentUserId} />
            ) : (
              <Navigate to="/feed" />
            )
          }
        />
        <Route
          path="/signup"
          element={
            !token ? (
              <Signup setToken={setToken} setCurrentUserId={setCurrentUserId} />
            ) : (
              <Navigate to="/feed" />
            )
          }
        />
        <Route
          path="/feed"
          element={token ? <Feed /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile/:id"
          element={
            token ? (
              <Profile currentUserId={currentUserId} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/search"
          element={token ? <SearchUsers /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to={token ? "/feed" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
