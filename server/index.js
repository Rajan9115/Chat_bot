const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();


const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Replace this with your actual OpenRouter API key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;



 

const fetchResponse = async (userMessage) => {
  const headers = {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",  
  };

  const data = {
    model: "openai/gpt-3.5-turbo", // You can replace with `google/gemini-pro` or any other
    messages: [
      {
        role: "system",
        content: "You are a helpful, friendly chatbot assistant. Respond clearly and conversationally.",
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
  };

  try {
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", data, {
      headers,
    });

    const botReply = response.data.choices[0].message.content.trim();
    return botReply || "Sorry, I couldn't understand that.";
  } catch (error) {
    console.error("OpenRouter API Error:", error.response?.data || error.message);
    return "⚠️ Something went wrong with the AI.";
  }
};

app.post("/api/message", async (req, res) => {
  const userMessage = req.body.message;
  console.log("User:", userMessage);

  try {
    const responseText = await fetchResponse(userMessage);
    res.json({ reply: responseText });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ reply: "⚠️ Oops! Something went wrong." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
