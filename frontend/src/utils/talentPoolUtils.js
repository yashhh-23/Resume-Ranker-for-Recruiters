import CryptoJS from "crypto-js";

// ─── Passphrase (stored only in memory, never persisted) ─────────────────────
let _passphrase = null;

export const setPassphrase = (phrase) => {
  _passphrase = phrase;
};

export const getPassphrase = () => _passphrase;

export const clearPassphrase = () => {
  _passphrase = null;
};

// ─── Storage key namespace (SHA-256 of passphrase → unique per recruiter) ────
const getStorageKey = () => {
  if (!_passphrase) return "rrr_recruiter_talent_pools_guest";
  const hash = CryptoJS.SHA256(_passphrase).toString().slice(0, 16);
  return `rrr_pools_${hash}`;
};

// ─── Default pool factory ─────────────────────────────────────────────────────
const getDefaultPools = () => [
  {
    id: "default-watchlist",
    name: "My Watchlist",
    createdAt: new Date().toISOString(),
    candidates: [],
  },
];

// ─── Read pools (decrypt if passphrase is set) ────────────────────────────────
export const getTalentPools = () => {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return getDefaultPools();

    if (_passphrase) {
      const bytes = CryptoJS.AES.decrypt(raw, _passphrase);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) return getDefaultPools(); // wrong passphrase or corrupted
      return JSON.parse(decrypted);
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse talent pools from localStorage", e);
    return getDefaultPools();
  }
};

// ─── Write pools (encrypt if passphrase is set) ───────────────────────────────
export const saveTalentPools = (pools) => {
  try {
    const data = JSON.stringify(pools);
    const toStore = _passphrase
      ? CryptoJS.AES.encrypt(data, _passphrase).toString()
      : data;
    localStorage.setItem(getStorageKey(), toStore);
  } catch (e) {
    console.error("Failed to save talent pools to localStorage", e);
  }
};

// ─── Pool CRUD ────────────────────────────────────────────────────────────────
export const createTalentPool = (name) => {
  const pools = getTalentPools();
  const trimmed = name.trim();
  if (!trimmed) return pools;

  if (pools.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    return pools;
  }

  const newPool = {
    id: `pool-${Date.now()}`,
    name: trimmed,
    createdAt: new Date().toISOString(),
    candidates: [],
  };
  pools.push(newPool);
  saveTalentPools(pools);
  return pools;
};

export const deleteTalentPool = (poolId) => {
  if (poolId === "default-watchlist") return getTalentPools(); // protect default watchlist
  const pools = getTalentPools().filter((p) => p.id !== poolId);
  saveTalentPools(pools);
  return pools;
};

export const addCandidateToTalentPool = (poolId, candidate, result = null) => {
  const pools = getTalentPools();
  const pool = pools.find((p) => p.id === poolId);
  if (pool) {
    const exists = pool.candidates.some(
      (c) => c.candidate_id === candidate.candidate_id
    );
    if (!exists) {
      pool.candidates.push({
        candidate_id: candidate.candidate_id,
        candidate,
        result: result || {
          candidate_id: candidate.candidate_id,
          rank: "-",
          score: 0,
        },
      });
      saveTalentPools(pools);
    }
  }
  return pools;
};

export const removeCandidateFromTalentPool = (poolId, candidateId) => {
  const pools = getTalentPools();
  const pool = pools.find((p) => p.id === poolId);
  if (pool) {
    pool.candidates = pool.candidates.filter(
      (c) => c.candidate_id !== candidateId
    );
    saveTalentPools(pools);
  }
  return pools;
};

export const getTalentPoolsWithCandidate = (candidateId) => {
  const pools = getTalentPools();
  return pools
    .filter((p) => p.candidates.some((c) => c.candidate_id === candidateId))
    .map((p) => p.id);
};
