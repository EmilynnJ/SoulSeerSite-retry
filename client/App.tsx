import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import Dashboard from "./pages/Dashboard";
import Readings from "./pages/Readings";
import Live from "./pages/Live";
import Shop from "./pages/Shop";
import Community from "./pages/Community";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import HelpCenter from "./pages/HelpCenter";
import Policies from "./pages/Policies";
import NotFound from "./pages/NotFound";
import AuthProvider from "./auth/AuthProvider";
import "./theme.css";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="/readings/*" element={<Readings />} />
          <Route path="/live/*" element={<Live />} />
          <Route path="/shop/*" element={<Shop />} />
          <Route path="/community/*" element={<Community />} />
          <Route path="/messages/*" element={<Messages />} />
          <Route path="/profile/*" element={<Profile />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/policies/*" element={<Policies />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;