# 🏨 Hotel Mirador Barcelona — AI Concierge

An AI-powered concierge chatbot for boutique hotels, built with Node.js, Express, and the Claude API.

## Features
- 💬 Natural language conversations in any language
- 🛏️ Room information and booking assistance
- 🍽️ Local restaurant and attraction recommendations
- ⚡ Real-time responses powered by Claude AI
- 🌍 Automatic multilingual support

## Setup

### 1. Install dependencies
```
npm install
```

### 2. Add your API key
Open the `.env` file and replace `your-api-key-here` with your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Start the server
```
node server.js
```

### 4. Open the chat
Open `index.html` in your browser — that's it!

## Customizing for a real hotel
Edit the `HOTEL_INFO` section in `server.js` to add your hotel's real information:
- Room types and prices
- Amenities
- Local recommendations
- Booking policies

## Tech stack
- **Backend**: Node.js + Express
- **AI**: Anthropic Claude API (claude-haiku-4-5)
- **Frontend**: Vanilla HTML/CSS/JS
