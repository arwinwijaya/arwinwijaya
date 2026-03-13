import fs from "node:fs/promises";

const user = process.env.LICHESS_USER || "marwinwijaya";
const token = process.env.CHESS_TOKEN || "";
const output = "metrics-chess.svg";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function chunkMoves(moves, size = 10) {
  const tokens = moves.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  for (let i = 0; i < tokens.length && lines.length < 3; i += size) {
    lines.push(tokens.slice(i, i + size).join(" "));
  }
  return lines;
}

function renderCard({ title, subtitle, rows, footer, accent = "#1f6feb" }) {
  const safeRows = rows.map((row, index) => {
    const y = 120 + index * 28;
    return `<text x="32" y="${y}" fill="#c9d1d9" font-size="18" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(row)}</text>`;
  }).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="260" viewBox="0 0 800 260" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(title)}</title>
  <desc id="desc">${escapeHtml(subtitle)}</desc>
  <rect width="800" height="260" rx="20" fill="#0d1117"/>
  <rect x="1" y="1" width="798" height="258" rx="19" stroke="#30363d"/>
  <rect x="24" y="24" width="8" height="212" rx="4" fill="${accent}"/>
  <text x="52" y="62" fill="#f0f6fc" font-size="30" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(title)}</text>
  <text x="52" y="92" fill="#8b949e" font-size="18" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(subtitle)}</text>
  ${safeRows}
  <text x="32" y="228" fill="#8b949e" font-size="15" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(footer)}</text>
</svg>
`;
}

function resultText(game, userLogin) {
  const white = game.players?.white?.user?.name || "White";
  const black = game.players?.black?.user?.name || "Black";
  const winner = game.winner;
  const lower = userLogin.toLowerCase();
  const userColor = white.toLowerCase() === lower ? "white" : black.toLowerCase() === lower ? "black" : null;
  if (!userColor) {
    return "Latest game found";
  }
  if (!winner) {
    return `Draw as ${userColor}`;
  }
  return winner === userColor ? `Win as ${userColor}` : `Loss as ${userColor}`;
}

async function fetchLatestGame() {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=1&tags=true&clocks=false&evals=false&opening=true&pgnInJson=true`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/x-ndjson",
    },
  });

  if (!response.ok) {
    throw new Error(`Lichess API returned ${response.status}`);
  }

  const body = await response.text();
  const line = body.split("\n").find((entry) => entry.trim());
  if (!line) {
    throw new Error("No game data returned");
  }

  const game = JSON.parse(line);
  if (!game.pgn || typeof game.pgn !== "string") {
    throw new Error("PGN missing from Lichess response");
  }
  return game;
}

async function main() {
  try {
    const game = await fetchLatestGame();
    const white = game.players?.white?.user?.name || "White";
    const black = game.players?.black?.user?.name || "Black";
    const whiteElo = game.players?.white?.rating ? ` (${game.players.white.rating})` : "";
    const blackElo = game.players?.black?.rating ? ` (${game.players.black.rating})` : "";
    const opening = game.opening?.name || "Opening unavailable";
    const status = game.status || "unknown";
    const moves = chunkMoves(game.moves || "");
    const rows = [
      `${resultText(game, user)} | ${game.speed || "unknown"} | ${game.variant || "standard"}`,
      `${white}${whiteElo} vs ${black}${blackElo}`,
      `${opening}`,
      ...moves.map((line, index) => index === 0 ? `Moves: ${line}` : `       ${line}`),
    ].slice(0, 5);
    const svg = renderCard({
      title: "Last Chess Game",
      subtitle: `Lichess profile: ${user}`,
      rows,
      footer: `Status: ${status} | https://lichess.org/${game.id || ""}`,
      accent: "#2ea043",
    });
    await fs.writeFile(output, svg, "utf8");
  } catch (error) {
    const svg = renderCard({
      title: "Last Chess Game",
      subtitle: `Lichess profile: ${user}`,
      rows: [
        "Chess data is temporarily unavailable.",
        "The README remains stable even if the API or token fails.",
        "Check the Metrics (Chess) workflow logs for details.",
      ],
      footer: `Last update attempt failed: ${error.message}`,
      accent: "#d29922",
    });
    await fs.writeFile(output, svg, "utf8");
    process.exitCode = 0;
  }
}

await main();
