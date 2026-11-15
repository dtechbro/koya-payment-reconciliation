// Payment reconciliation.
//
// Reads payments.jsonl and works out how much money we actually collected.
// Run:  node reconcile.js

const fs = require("fs");

function parseAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return Number.NaN;
    }

    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : Number.NaN;
  }

  return Number.NaN;
}

function parseTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return Number.NaN;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NaN;
}

const latestByTxn = new Map();
const lines = fs.readFileSync("payments.jsonl", "utf8").split(/\r?\n/);

for (const [index, line] of lines.entries()) {
  if (!line.trim()) {
    continue;
  }

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }

  if (!event || typeof event !== "object") {
    continue;
  }

  if (!Object.prototype.hasOwnProperty.call(event, "txn_id")) {
    continue;
  }

  const txnId = String(event.txn_id).trim();
  if (!txnId) {
    continue;
  }

  const amount = parseAmount(event.amount);
  if (!Number.isFinite(amount)) {
    continue;
  }

  const status = typeof event.status === "string" ? event.status.trim().toLowerCase() : "";
  const timestamp = parseTimestamp(event.ts);
  const candidate = { status, amount, timestamp, index };
  const current = latestByTxn.get(txnId);

  if (!current) {
    latestByTxn.set(txnId, candidate);
    continue;
  }

  const currentTime = Number.isFinite(current.timestamp) ? current.timestamp : Number.NEGATIVE_INFINITY;
  const candidateTime = Number.isFinite(candidate.timestamp) ? candidate.timestamp : Number.NEGATIVE_INFINITY;

  if (candidateTime > currentTime || (candidateTime === currentTime && candidate.index > current.index)) {
    latestByTxn.set(txnId, candidate);
  }
}

let total = 0;
let count = 0;

for (const event of latestByTxn.values()) {
  if (event.status !== "success") {
    continue;
  }

  total += event.amount;
  count += 1;
}

const expected = parseInt(fs.readFileSync("expected.txt", "utf8").trim(), 10);

if (count !== expected) {
  console.log(`Check failed: counted ${count} successful payments, expected ${expected}.`);
  console.log("Something in the data isn't being handled the way the README describes.");
} else {
  console.log(`Check passed: ${count} successful payments.`);
  console.log(`Your code: KOYA-${Math.round(total)}`);
}
