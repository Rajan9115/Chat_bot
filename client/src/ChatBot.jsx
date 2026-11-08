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
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(false);

  const messageEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  // Auto-focus on input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll to latest message
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check if browser supports Web Speech API
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSpeechSupported(Boolean(SpeechRecognition));

    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
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

  // Start speech recognition session with permission check and auto-keepalive
  const startListening = async () => {
    setVoiceError("");
    setVoiceStatus("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    // Explicitly prompt/verify microphone permission via getUserMedia
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        setVoiceStatus("Accessing microphone...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release stream so SpeechRecognition can bind it exclusively
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err) {
      console.error("Microphone permission check failed:", err);
      setVoiceError("Microphone access blocked. Click the lock icon in your address bar to enable mic permissions.");
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    // Abort any previous session
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Continuous listening
      recognition.interimResults = true; // Show words as user speaks
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setVoiceStatus("Listening... speak into your microphone");
      };

      recognition.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript + " ";
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        const fullText = (finalTranscript + interimTranscript).trim();
        if (fullText) {
          setInput(fullText);
          setVoiceStatus(`Heard: "${fullText.slice(-35)}"`);
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition event:", event.error);

        // "no-speech" is not fatal - user is just paused or hasn't started yet!
        if (event.error === "no-speech") {
          setVoiceStatus("Listening... (say something!)");
          return;
        }

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setVoiceError("Microphone permission blocked. Please allow mic in browser settings.");
        } else if (event.error === "audio-capture") {
          setVoiceError("No microphone hardware found on your device.");
        } else if (event.error === "network") {
          setVoiceError("Speech recognition network error. Please check your internet connection.");
        } else {
          setVoiceError(`Voice notice: ${event.error}`);
        }

        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        // If user is still meant to be listening (and no fatal error occurred), auto-restart
        if (isListeningRef.current) {
          try {
            recognition.start();
            return;
          } catch (e) {}
        }
        setIsListening(false);
        isListeningRef.current = false;
        setVoiceStatus("");
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Could not start speech recognition:", err);
      setVoiceError("Could not start voice recognition: " + err.message);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
    setVoiceStatus("");
  };

  // Toggle voice listening
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const sendMessage = async (overrideText) => {
    const textToSend = (typeof overrideText === "string" ? overrideText : input).trim();
    if (!textToSend) return;

    // Stop listening when sending
    if (isListening) {
      stopListening();
    }
    setVoiceError("");

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

      {/* Voice Status & Error Feedback Area */}
      {isListening && voiceStatus && (
        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium px-1 mt-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
          <span>{voiceStatus}</span>
        </div>
      )}
      {voiceError && (
        <div className="text-xs text-red-600 dark:text-red-400 font-medium px-1 mt-2 flex items-center gap-1">
          <span>⚠️ {voiceError}</span>
        </div>
      )}

      {/* Input section */}
      <div className="flex gap-2 mt-2 items-center">
        <input 
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="w-full p-2.5 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={isListening ? "🎙️ Listening... speak now..." : "Type a message or use voice..."}
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
