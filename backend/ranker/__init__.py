"""RRR backend ranking engine."""

from .candidate_scorer import rank_candidates
from .jd_parser import parse_jd, parse_jd_docx, parse_jd_text, extract_dynamic_skills_from_jd

__all__ = ["rank_candidates", "parse_jd", "parse_jd_docx", "parse_jd_text", "extract_dynamic_skills_from_jd"]

__version__ = "1.0.0"
__model__ = "all-MiniLM-L6-v2"
