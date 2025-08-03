import React, { useRef, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useWebSocketReading from "../hooks/useWebSocketReading";
import { useQuery } from "@tanstack/react-query";

export default function ChatSession() {
  const { readingId } = useParams();
  const navigate = useNavigate();
  const {
    messages,
    sendMessage,
    minutes,
    cost,
    balance,
    status,
    readerName,
    rate,
  } = useWebSocketReading(Number(readingId));

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // If session ends, redirect to summary (placeholder)
  useEffect(() => {
    if (status === "ended") {
      setTimeout(() => navigate("/dashboard/readings?ended=" + readingId), 1500);
    }
  }, [status, navigate, readingId]);

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center justify-center px-1 pt-10">
      <div className="w-full max-w-lg bg-black/90 rounded-2xl shadow-xl flex flex-col h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-pink">
          <div>
            <div className="font-heading text-xl text-pink">{readerName || "Psychic"}</div>
            <div className="text-gold font-body text-sm">${(rate / 100).toFixed(2)}/min</div>
          </div>
          <div className="text-white font-body flex flex-col items-end text-xs">
            <span>
              <span className="text-pink font-bold">{minutes}</span> min
            </span>
            <span>
              <span className="text-gold font-bold">${(cost / 100).toFixed(2)}</span> total
            </span>
            <span>
              Bal: <span className="text-green-400 font-bold">${(balance / 100).toFixed(2)}</span>
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-gold text-center mt-6">Session started. Say hello!</div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-2xl font-body text-base break-words
                    ${
                      msg.mine
                        ? "bg-pink text-white rounded-br-sm"
                        : "bg-gray-800 text-gold rounded-bl-sm"
                    }`}
                >
                  {msg.text}
                  <span className="block text-xs text-white/60 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <form
          className="flex items-center px-4 py-2 border-t border-pink"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || status === "ended") return;
            sendMessage(input);
            setInput("");
          }}
        >
          <input
            type="text"
            className="flex-1 px-4 py-2 rounded-full bg-celestial text-white font-body border border-gold focus:outline-none"
            placeholder={status === "ended" ? "Session ended" : "Type your message..."}
            disabled={status === "ended"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || status === "ended"}
            className="ml-3 px-5 py-2 rounded-full bg-pink text-white font-bold shadow-glow hover:bg-gold hover:text-black transition disabled:bg-gray-400"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}