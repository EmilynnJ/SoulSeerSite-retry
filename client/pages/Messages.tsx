import React, { useState } from "react";
import ConversationList from "../components/ConversationList";
import MessageThread from "../components/MessageThread";
import useDMWebSocket from "../hooks/useDMWebSocket";
import { useUser } from "@clerk/clerk-react";

export default function Messages() {
  const { user } = useUser();
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  useDMWebSocket(user?.id);

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-10 px-2">
      <div className="bg-black bg-opacity-80 rounded-2xl shadow-xl p-8 max-w-5xl w-full flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/3">
          <ConversationList activeUserId={activeUserId} onSelect={setActiveUserId} />
        </div>
        <div className="flex-1 h-[50vh] md:h-[70vh] flex flex-col">
          {activeUserId ? (
            <MessageThread userId={activeUserId} />
          ) : (
            <div className="text-gold font-body flex items-center justify-center h-full">
              Select a conversation to start messaging.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}