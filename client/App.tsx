import React from "react";
import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/lib/queryClient";
import { Toaster } from "react-hot-toast";
import "./theme.css";

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import Dashboard from "./pages/Dashboard";
import Readings from "./pages/Readings";
import ReaderProfile from "./pages/ReaderProfile";
import SessionWait from "./pages/SessionWait";
import ChatSession from "./pages/ChatSession";
import VideoSession from "./pages/VideoSession";
import ReadingSummary from "./pages/ReadingSummary";
import Live from "./pages/Live";
import Shop from "./pages/Shop";
import Community from "./pages/Community";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import HelpCenter from "./pages/HelpCenter";
import Policies from "./pages/Policies";
import NotFound from "./pages/NotFound";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import AuthProvider from "./auth/AuthProvider";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import CartProvider from "./cart/CartContext";

function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Toaster position="top-center" />
      <NavBar />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <Router>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/dashboard/*" element={<Dashboard />} />
                <Route path="/readings" element={<Readings />} />
                <Route path="/readings/:readerId" element={<ReaderProfile />} />
                <Route path="/readings/session/:readingId" element={<SessionWait />} />
                <Route path="/readings/session/:readingId/chat" element={<ChatSession />} />
                <Route path="/readings/session/:readingId/video" element={<VideoSession />} />
                <Route path="/dashboard/readings/summary/:readingId" element={<ReadingSummary />} />
                <Route path="/live" element={<Live />} />
                <Route path="/live/:streamKey" element={<LiveStreamRoom />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/shop/checkout" element={<Checkout />} />
                <Route path="/shop/:id" element={<ProductPage />} />
                <Route path="/community/*" element={<Community />} />
                <Route path="/messages/*" element={<Messages />} />
                <Route path="/profile/*" element={<Profile />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/policies/*" element={<Policies />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/signup" element={<SignUpPage />} />
            </Routes>
          </Router>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;