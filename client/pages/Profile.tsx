import React from "react";
// TODO: Connect with Clerk, Neon, Stripe; load user info, allow edits

export default function Profile() {
  // Demo user info - replace with real data fetch
  const user = {
    name: "Jane Doe",
    role: "client",
    email: "jane@example.com",
    profileImage: "https://i.pravatar.cc/150?img=65"
  };

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-16 pb-8 px-4">
      <div className="max-w-xl w-full bg-black bg-opacity-70 rounded-2xl shadow-xl p-8 text-white animate-fade-in">
        <h1 className="font-heading text-3xl text-pink mb-6">My Profile</h1>
        <div className="flex items-center gap-6 mb-6">
          <img
            src={user.profileImage}
            alt="Profile"
            className="w-24 h-24 rounded-full border-4 border-gold shadow-lg"
          />
          <div>
            <div className="font-heading text-xl text-pink">{user.name}</div>
            <div className="font-body text-gold capitalize">{user.role}</div>
            <div className="font-body text-sm text-white">{user.email}</div>
          </div>
        </div>
        <button className="bg-pink text-white px-8 py-3 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition">
          Edit Profile
        </button>
      </div>
    </div>
  );
}