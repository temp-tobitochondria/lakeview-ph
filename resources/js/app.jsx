import './bootstrap';
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MapPage from "./MapPage";
import AboutPage from "./AboutPage";
import UserManual from "./UserManual";
import SubmitFeedback from "./SubmitFeedback";
import AboutData from "./AboutData";
import Settings from "./Settings";
import '../css/index.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Map is the homepage */}
        <Route path="/" element={<MapPage />} />

        {/* Stand-in pages */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/manual" element={<UserManual />} />
        <Route path="/feedback" element={<SubmitFeedback />} />
        <Route path="/data" element={<AboutData />} />
        <Route path="/settings" element={<Settings />} />

        {/* Optional: placeholder Sign-in page */}
        <Route
          path="/signin"
          element={
            <div style={{ padding: "20px" }}>
              <h1>Sign-in</h1>
              <p>This is a placeholder for the sign-in page.</p>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

// ✅ Mount App to the root div
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
