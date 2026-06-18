import hashlib
import pickle
from pathlib import Path
from typing import Dict, Iterable, List

import numpy as np


CACHE_VERSION = "rrr-embeddings-v1"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def load_model(model_name: str = MODEL_NAME):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


PROFICIENCY_WEIGHT = {
    "expert": 3,
    "advanced": 2,
    "intermediate": 1,
    "beginner": 0.5,
}


def candidate_embedding_text(candidate: Dict) -> str:
    skill_tokens = []
    for skill in candidate.get("skills") or []:
        name = str(skill.get("name") or "").strip()
        if not name:
            continue
        level = str(skill.get("proficiency") or "intermediate").lower().strip()
        weight = PROFICIENCY_WEIGHT.get(level, 1)
        skill_tokens.extend([name] * int(weight))

    profile = candidate.get("profile") or {}
    profile_text = " ".join(
        str(profile.get(field) or "")
        for field in ("headline", "summary", "current_title", "current_industry")
    )

    career_history = candidate.get("career_history") or []
    career_titles = " ".join(
        str(role.get("title") or "")
        for role in career_history
    )

    return " ".join([profile_text, career_titles, " ".join(skill_tokens)]).strip()


def cache_key(candidate: Dict) -> str:
    candidate_id = str(candidate.get("candidate_id") or candidate.get("id") or "")
    text = candidate_embedding_text(candidate)
    digest = hashlib.sha256(f"{CACHE_VERSION}|{candidate_id}|{text}".encode("utf-8")).hexdigest()
    return f"{candidate_id}:{digest}"


from collections import OrderedDict

MAX_CACHE_ENTRIES = 20_000   # ~30MB cap for 384-dim embeddings

class LRUEmbeddingCache:
    def __init__(self, maxsize: int = MAX_CACHE_ENTRIES):
        self._cache: OrderedDict[str, np.ndarray] = OrderedDict()
        self._maxsize = maxsize

    def get(self, key: str):
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def set(self, key: str, value: np.ndarray):
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = value
        if len(self._cache) > self._maxsize:
            self._cache.popitem(last=False)  # evict oldest

_EMBEDDING_CACHE = LRUEmbeddingCache()

def load_cache(cache_path: str = ".embedding_cache.pkl"):
    return _EMBEDDING_CACHE


def save_cache(cache, cache_path: str = None) -> None:
    """No-op: embeddings are stored in-memory (_EMBEDDING_CACHE).
    Retained for CLI backward-compatibility only."""
    pass


def embed_texts(model, texts: Iterable[str]) -> np.ndarray:
    return np.asarray(
        model.encode(
            list(texts),
            batch_size=64,
            show_progress_bar=False,
            normalize_embeddings=True,
        ),
        dtype=np.float32,
    )


def get_candidate_embeddings(
    candidates: List[Dict],
    model,
    cache_path: str = ".embedding_cache.pkl",
) -> Dict[str, np.ndarray]:
    cache = load_cache(cache_path)
    missing_candidates = []
    missing_keys = []
    missing_texts = []

    for candidate in candidates:
        key = cache_key(candidate)
        if cache.get(key) is None:
            missing_candidates.append(candidate)
            missing_keys.append(key)
            missing_texts.append(candidate_embedding_text(candidate))

    if missing_texts:
        vectors = embed_texts(model, missing_texts)
        for key, vector in zip(missing_keys, vectors):
            cache.set(key, vector)
        save_cache(cache, cache_path)

    return {str(candidate.get("candidate_id") or candidate.get("id") or ""): cache.get(cache_key(candidate)) for candidate in candidates}

def get_jd_embedding(jd: dict, model, cache_path: str = ".embedding_cache.pkl") -> np.ndarray:
    skills_text = str(jd.get("skills_text") or "")
    jd_key = "jd:" + hashlib.md5(skills_text.encode()).hexdigest()
    cache = load_cache(cache_path)
    cached = cache.get(jd_key)
    if cached is not None:
        return cached
    embedding = embed_texts(model, [skills_text])[0]
    cache.set(jd_key, embedding)
    return embedding


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    if left is None or right is None:
        return 0.0
    return float(np.clip(np.dot(left, right), -1.0, 1.0))
