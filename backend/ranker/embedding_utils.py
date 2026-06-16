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


PROF_WEIGHTS = {
    "expert": 1.0,
    "advanced": 0.85,
    "intermediate": 0.65,
    "beginner": 0.4,
}


def candidate_embedding_text(candidate: Dict) -> str:
    skill_tokens = []
    for skill in candidate.get("skills") or []:
        name = str(skill.get("name") or "").strip()
        if not name:
            continue
        proficiency = str(skill.get("proficiency") or "").lower().strip()
        weight = PROF_WEIGHTS.get(proficiency, 0.5)
        repeat = max(1, int(weight * 3))
        skill_tokens.append(f"{name} " * repeat)

    profile = candidate.get("profile") or {}
    profile_text = " ".join(
        str(profile.get(field) or "")
        for field in ("headline", "summary", "current_title", "current_industry")
    )

    return " ".join([profile_text, " ".join(skill_tokens)]).strip()


def cache_key(candidate: Dict) -> str:
    candidate_id = str(candidate.get("candidate_id") or candidate.get("id") or "")
    text = candidate_embedding_text(candidate)
    digest = hashlib.sha256(f"{CACHE_VERSION}|{candidate_id}|{text}".encode("utf-8")).hexdigest()
    return f"{candidate_id}:{digest}"


def load_cache(cache_path: str = ".embedding_cache.pkl") -> Dict[str, np.ndarray]:
    path = Path(cache_path)
    if not path.exists():
        return {}
    try:
        with path.open("rb") as handle:
            payload = pickle.load(handle)
        if payload.get("version") != CACHE_VERSION:
            return {}
        return payload.get("embeddings") or {}
    except Exception:
        return {}


def save_cache(cache: Dict[str, np.ndarray], cache_path: str = ".embedding_cache.pkl") -> None:
    path = Path(cache_path)
    with path.open("wb") as handle:
        pickle.dump({"version": CACHE_VERSION, "embeddings": cache}, handle)


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
        if key not in cache:
            missing_candidates.append(candidate)
            missing_keys.append(key)
            missing_texts.append(candidate_embedding_text(candidate))

    if missing_texts:
        vectors = embed_texts(model, missing_texts)
        for key, vector in zip(missing_keys, vectors):
            cache[key] = vector
        save_cache(cache, cache_path)

    return {str(candidate.get("candidate_id") or candidate.get("id") or ""): cache[cache_key(candidate)] for candidate in candidates}


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    if left is None or right is None:
        return 0.0
    return float(np.clip(np.dot(left, right), -1.0, 1.0))
