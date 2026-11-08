import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const rawApiUrl = process.env.REACT_APP_API_URL || "https://chat-bot-server-xi.vercel.app/api/message";
const API_URL = rawApiUrl.endsWith("/api/message")
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/+$/, "")}/api/message`;

const ChatBot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(false);

  const messageEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-focus on input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll to latest message
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize Web Speech API (Speech Recognition)
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Stop when the speaker pauses
      recognition.interimResults = true; // Show words as user speaks
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInput(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setIsSpeechSupported(false);
      console.warn("Web Speech API is not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text-to-speech helper (Speaks bot reply)
  const speakReply = (text) => {
    if (!isSpeakingEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const cleanText = text.replace(/[*#_`~]/g, ""); // Strip markdown symbols
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis error:", err);
    }
  };

  // Toggle voice listening
  const toggleListening = () => {
    if (!isSpeechSupported) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error("Could not start speech recognition:", err);
      }
    }
  };

  const sendMessage = async (overrideText) => {
    const textToSend = (typeof overrideText === "string" ? overrideText : input).trim();
    if (!textToSend) return;

    // If currently listening, stop recognition
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMsg = {
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await axios.post(API_URL, {
        message: textToSend,
      });

      const replyText = response.data.reply;
      const botMsg = {
        sender: "bot",
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);

      // Speak reply if voice is enabled
      speakReply(replyText);
    } catch (error) {
      const errorMsg = {
        sender: "bot",
        text: "⚠️ Oops! Something went wrong. Please try again.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl bg-white p-6 rounded-xl shadow-lg flex flex-col h-[650px] dark:bg-gray-900">
      {/* Header bar with Voice Output Toggle */}
      <div className="flex justify-between items-center pb-3 border-b mb-2 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">AI Assistant</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isSpeakingEnabled && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
            }
            setIsSpeakingEnabled(!isSpeakingEnabled);
          }}
          title={isSpeakingEnabled ? "Mute voice replies" : "Enable voice replies"}
          className="text-xs font-medium px-2.5 py-1 rounded-full border transition flex items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
        >
          {isSpeakingEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
        </button>
      </div>

      {/* Chat area */}
      <div className="flex flex-col gap-2 p-4 overflow-y-auto bg-gray-100 dark:bg-gray-800 flex-1 rounded-lg">
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
              <div className="text-base whitespace-pre-wrap">{msg.text}</div>
              <div className="text-[0.75rem] text-gray-500 dark:text-gray-400 mt-1">{msg.time}</div>
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
      <div className="flex gap-2 mt-3 items-center">
        <input 
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="w-full p-2.5 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={isListening ? "🎙️ Listening... speak clearly..." : "Type a message or use voice..."}
        />

        {/* Microphone Button */}
        {isSpeechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? "Stop listening" : "Click to speak"}
            className={`p-2.5 px-3.5 rounded-lg border transition-all flex items-center justify-center text-lg ${
              isListening
                ? "bg-red-500 text-white animate-pulse border-red-600 shadow-md scale-105"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
            }`}
          >
            {isListening ? "⏹️" : "🎙️"}
          </button>
        )}

        {/* Send Button */}
        <button
          onClick={() => sendMessage()}
          className="bg-blue-500 text-white px-5 py-2.5 rounded-lg hover:bg-blue-600 transition font-medium"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatBot;
