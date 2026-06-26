# Code Piece 🕵️‍♂️💬

**Code Piece** is a modern, real-time multiplayer word association game inspired by the classic board game _Codenames_. Built with Next.js, React, and Socket.IO, players split into Red and Blue teams, competing to identify all of their secret agent cards on a shared board using single-word clues.

---

## 🚀 Features

- **Real-Time Multiplayer:** Built on WebSockets (Socket.IO) for instantaneous synchronization of game state, room creation, joining, and player actions.
- **Persistent Player Sessions:** Tab refresh or brief disconnect? A grace period window allows players to reconnect right back into their team and role.
- **Dynamic Card Animations:** Smooth flipping transitions using `framer-motion` for cards when revealed.
- **Customizable Word Categories:** Select from various themed word lists to keep game sessions fresh.
- **Responsive Premium Design:** Sleek dark-mode aesthetic with tailwind styling, optimized for both desktop monitors and mobile devices.
- **Safe Inputs:** Secure validation on room codes, player names, clue counts, and event rate limits.

---

## 🎮 How to Play

The game requires **two teams** (Red and Blue). Each team must have:

1. **At least one Spymaster**
2. **At least one Operative**

### The Objective

Find all of your team's cards on the board before the opposing team finds theirs. **Avoid the Assassin card at all costs!**

### Step-by-Step Gameplay:

1. **The Setup:** A grid of 25 cards is generated. Each card represents a hidden agent (Red or Blue), a neutral bystander (gray), or the Assassin (black).
2. **The Roles:**
   - **Spymasters:** Can see the true identities of all 25 cards. They take turns giving a **single-word clue** and a **number** (e.g., `"Water" 2`) representing how many cards on the board relate to that clue.
   - **Operatives:** Can only see the words (the colors are hidden until guessed). Based on the Spymaster's clue, they discuss and click cards to reveal their colors.
3. **Guessing rules:**
   - Operatives can guess up to the given clue number **plus one** extra guess.
   - If they guess a card of their team's color, they can continue guessing.
   - If they guess a neutral card or an opponent's card, their turn ends immediately.
   - If they guess the **Assassin** card, their team loses the game instantly.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Next.js (App Router), Tailwind CSS, Framer Motion
- **Backend:** Custom Node.js server (`server.js`), Socket.IO (WebSockets)
- **Language:** TypeScript / JavaScript

---
