import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const ChatBot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messageEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-focus on input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll to latest message
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = {
      sender: "user",
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await axios.post("http://localhost:5000/api/message", {
        message: input,
      });

      const botMsg = {
        sender: "bot",
        text: response.data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      const errorMsg = {
       sender: "bot",
        text: "⚠️ Oops! Something went wrong. Please try again.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl bg-white p-6 rounded-xl shadow-lg flex flex-col h-[650px] dark:bg-gray-900">

      {/* Chat area */}
      <div className="flex flex-col gap-2 p-4 overflow-y-auto bg-gray-100 dark:bg-gray-800 flex-1">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-end gap-2 max-w-xs p-2 rounded-lg transform transition-all duration-300 
              ${msg.sender === "user"
                ? "bg-blue-200 dark:bg-blue-600 self-end ml-auto text-right"
                : "bg-gray-200 dark:bg-gray-700 self-start text-left"}`}
          >
            <div className="text-xl">
              {msg.sender === "user" ? "👤" : "🤖"}
            </div>
            <div>
              <div className="text-sm font-semibold">
                {msg.sender === "user" ? "You" : "Bot"}
              </div>
              <div className="text-base">{msg.text}</div>
              <div className="text-[0.75rem] text-gray-500 mt-1">{msg.time}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 items-center self-start">
            <div className="text-2xl">🤖</div>
            <div className="flex space-x-1">
              <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* Input section */}
      <div className="flex gap-2 mt-2">
        <input 
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white dark:border-gray-600"
          placeholder="Type your message..."
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatBot;
