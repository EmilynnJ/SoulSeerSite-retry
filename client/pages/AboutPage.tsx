import React from "react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-16 pb-8 px-4">
      <div className="max-w-2xl w-full bg-black bg-opacity-70 rounded-2xl shadow-xl p-8 text-white animate-fade-in">
        <h1 className="font-heading text-4xl text-pink mb-4">About SoulSeer</h1>
        <img
          src="https://i.postimg.cc/s2ds9RtC/FOUNDER.jpg"
          alt="Founder Emilynn"
          className="w-32 h-32 rounded-full border-4 border-gold shadow-lg mb-6 mx-auto"
        />
        <p className="font-body text-lg whitespace-pre-line text-white">
          At SoulSeer, we are dedicated to providing ethical, compassionate, and judgment-free spiritual guidance. Our mission is twofold: to offer clients genuine, heart-centered readings and to uphold fair, ethical standards for our readers.
          <br /><br />
          Founded by psychic medium Emilynn, SoulSeer was created as a response to the corporate greed that dominates many psychic platforms. Unlike other apps, our readers keep the majority of what they earn and play an active role in shaping the platform.
          <br /><br />
          SoulSeer is more than just an app—it’s a soul tribe. A community of gifted psychics united by our life’s calling: to guide, heal, and empower those who seek clarity on their journey.
        </p>
        <div className="mt-8 text-center">
          <span className="text-gold text-lg font-bold">With love & light,</span>
          <div className="font-heading text-2xl text-pink">Emilynn</div>
        </div>
      </div>
    </div>
  );
}