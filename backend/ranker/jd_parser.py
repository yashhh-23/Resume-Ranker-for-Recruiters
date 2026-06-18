import regex as re
from pathlib import Path
from typing import Dict, List

DEFAULT_JD = {
    "required_skills": [],
    "raw_required_skills": [],
    "preferred_skills": [],
    "target_title": "Any",
    "min_experience_years": 0,
    "target_industry": "Any",
    "target_field": "Computer Science",
    "skills_text": "",
    "salary_min": 0.0,
    "salary_max": 0.0,
    "seniority_level": "mid",
}

INDUSTRY_KEYWORDS = {
    "tech": ["software", "engineer", "developer", "data", "ML", "AI", "backend", "frontend"],
    "finance": ["fintech", "banking", "financial", "accounting", "audit", "investment"],
    "marketing": ["marketing", "SEO", "content", "brand", "growth", "digital"],
    "sales": ["sales", "business development", "BD", "account executive"],
    "healthcare": ["health", "medical", "pharma", "clinical", "hospital"],
    "design": ["UI", "UX", "designer", "figma", "illustrator", "creative"],
}

REQUIRED_HEADERS = ["required", "must have", "mandatory", "essential"]
PREFERRED_HEADERS = ["preferred", "nice to have", "bonus", "good to have", "desired"]

TECH_SKILLS = [
    "Python",
    "SQL",
    "Spark",
    "PySpark",
    "Airflow",
    "Apache Beam",
    "Kafka",
    "AWS",
    "GCP",
    "Azure",
    "Snowflake",
    "BigQuery",
    "Docker",
    "Kubernetes",
    "MLflow",
    "NLP",
    "TensorFlow",
    "PyTorch",
    "Scikit-learn",
    "LLM",
    "Fine-tuning LLMs",
    "React",
    "Next.js",
    "Node.js",
    "Java",
    "TypeScript",
    "Angular",
    "Apache Flink",
    "BM25",
    "BentoML",
    "CI/CD",
    "CNN",
    "CSS",
    "Computer Vision",
    "Data Pipelines",
    "Data Science",
    "Databricks",
    "Deep Learning",
    "Django",
    "ETL",
    "Elasticsearch",
    "Embeddings",
    "FAISS",
    "FastAPI",
    "Feature Engineering",
    "Flask",
    "Forecasting",
    "GANs",
    "Go",
    "GraphQL",
    "HTML",
    "Hadoop",
    "Haystack",
    "Hugging Face Transformers",
    "Image Classification",
    "Information Retrieval",
    "JavaScript",
    "Kubeflow",
    "LangChain",
    "LoRA",
    "MLOps",
    "Machine Learning",
    "Microservices",
    "Milvus",
    "MongoDB",
    "Object Detection",
    "OpenCV",
    "OpenSearch",
    "PEFT",
    "Pinecone",
    "PostgreSQL",
    "Prompt Engineering",
    "Qdrant",
    "REST APIs",
    "Recommendation Systems",
    "Redis",
    "Redux",
    "Reinforcement Learning",
    "Rust",
    "SEO",
    "Sentence Transformers",
    "Speech Recognition",
    "Spring Boot",
    "Statistical Modeling",
    "TTS",
    "Tailwind",
    "Terraform",
    "Vector Search",
    "Vue.js",
    "Weaviate",
    "Webpack",
    "Weights & Biases",
    "YOLO",
    "dbt",
    "gRPC",
    "GitHub Actions",
    "Polars",
    "DuckDB",
    "OpenAI API",
    "Prisma",
    "Ray",
    "LlamaIndex",
]

SOFT_SKILLS = [
    "Accounting",
    "Agile",
    "Content Writing",
    "Excel",
    "Figma",
    "Illustrator",
    "Marketing",
    "Photoshop",
    "PowerPoint",
    "Project Management",
    "SAP",
    "Sales",
    "Salesforce CRM",
    "Scrum",
    "Six Sigma",
    "Tally",
]

TITLE_PATTERNS = [
    r"(?:looking for|hiring|role[:\s]+|position[:\s]+|job title[:\s]+)(?:an?\s+)?([A-Z][A-Za-z /+-]*(?:Engineer|Developer|Scientist|Analyst|Manager|Architect|Specialist))",
    r"\b(ML Engineer|Machine Learning Engineer|Data Engineer|Backend Engineer|"
    r"Frontend Engineer|Full Stack Developer|Data Scientist|Business Analyst|"
    r"Product Manager|SDE-I|SDE-II|SDE-III|SDE I|SDE II|SDE III|"
    r"Technical Program Manager|Associate Consultant|Founding Engineer|"
    r"DevOps Engineer|Platform Engineer|Site Reliability Engineer|"
    r"Research Engineer|Applied Scientist)\b",
]


def _dedupe(items: List[str]) -> List[str]:
    seen = set()
    output = []
    for item in items:
        cleaned = item.strip(" -•\t\r\n,.;:")
        if not cleaned:
            continue
        key = cleaned.lower()
        if key not in seen:
            seen.add(key)
            output.append(cleaned)
    return output


def _extract_docx_text(path: Path) -> str:
    try:
        from docx import Document

        document = Document(path)
        chunks = [paragraph.text for paragraph in document.paragraphs]
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    chunks.append(cell.text)
        return "\n".join(chunk for chunk in chunks if chunk)
    except Exception:
        return ""


def _extract_section_lines(text: str, anchors: List[str]) -> List[str]:
    lines = [line.strip() for line in text.splitlines()]
    captured = []
    active = False
    section_re = re.compile(r"^[A-Za-z ]{3,35}:?$")

    for line in lines:
        lowered = line.lower().strip(":")
        if any(anchor in lowered for anchor in anchors):
            active = True
            tail = re.sub(r"^[^:]{0,40}:", "", line).strip()
            if tail and tail != line:
                captured.append(tail)
            continue
        if active and section_re.match(line) and not line.startswith(("-", "•")):
            active = False
        elif active and line:
            captured.append(line)

    return captured


def _split_skill_lines(lines: List[str]) -> List[str]:
    skills = []
    for line in lines:
        parts = re.split(r"[,;/|]|\band\b|\.\s+", line)
        for part in parts:
            cleaned = re.sub(r"^[\-•*]\s*", "", part).strip()
            if (
                1 <= len(cleaned.split()) <= 4
                and len(cleaned) <= 32
                and not re.search(
                    r"\b(this|that|beyond|practical|probably|terms|range|used)\b",
                    cleaned,
                    re.IGNORECASE,
                )
            ):
                skills.append(cleaned)
    return _dedupe(skills)


def _known_skill_hits(text: str, skill_list: List[str]) -> List[str]:
    hits = []
    lowered = text.lower()
    for skill in skill_list:
        if skill.lower() in lowered:
            hits.append(skill)
    return _dedupe(hits)


def _extract_title(text: str) -> str:
    compact = " ".join(text.split())
    for pattern in TITLE_PATTERNS:
        match = re.search(pattern, compact, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return DEFAULT_JD["target_title"]


def _extract_experience(text: str) -> int:
    # Try to find a range first: "2-5 years", "3 to 7 years"
    range_match = re.search(
        r"(\d+)\s*(?:-|to)\s*(\d+)\+?\s*(?:years?|yrs?)", text, flags=re.IGNORECASE
    )
    if range_match:
        return int(range_match.group(2))  # use upper bound as min_experience
    # Fallback to single number
    single_match = re.search(r"(\d+)\+?\s*(?:years?|yrs?)", text, flags=re.IGNORECASE)
    if single_match:
        return int(single_match.group(1))
    return 0


def _extract_industry(text: str) -> str:
    match = re.search(
        r"(?:industry|domain)[:\s]+([A-Za-z &/-]{3,40})", text, flags=re.IGNORECASE
    )
    if match:
        return match.group(1).strip(" .")

    text_lower = text.lower()
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        if any(kw.lower() in text_lower for kw in keywords):
            return industry

    return DEFAULT_JD["target_industry"]


def _infer_industry_from_context(title: str, text_snippet: str) -> str:
    combined = (title + " " + text_snippet[:300]).lower()
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        if any(kw.lower() in combined for kw in keywords):
            return industry
    return DEFAULT_JD["target_industry"]


def _extract_field(text: str) -> str:
    fields = [
        "Computer Science",
        "Data Science",
        "Information Technology",
        "Statistics",
        "Mathematics",
        "Engineering",
        "Business",
        "Design",
        "Marketing",
    ]
    lowered = text.lower()
    for field in fields:
        if field.lower() in lowered:
            return field
    return DEFAULT_JD["target_field"]


def _extract_salary_range(text: str) -> tuple[float, float]:
    LPA_RANGE_PATTERNS = [
        r"(\d+(?:\.\d+)?)\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)\s*[Ll][Pp][Aa]",    # "8–15 LPA"
        r"(\d+(?:\.\d+)?)\s*[Ll][Pp][Aa]\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)\s*[Ll][Pp][Aa]",  # "8LPA-15LPA"
        r"(\d+(?:\.\d+)?)\s*[Ll](?:[Pp][Aa])?\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)", # "8L-15"
    ]
    for pat in LPA_RANGE_PATTERNS:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return float(m.group(1)) * 100_000, float(m.group(2)) * 100_000

    # Only fall through to single-value if NO range matched
    lpa_single = re.search(
        r"(?:₹|INR|Rs\.?\s*)?(\d+(?:\.\d+)?)\s*[Ll][Pp][Aa]\b",
        text, re.IGNORECASE
    )
    if lpa_single:
        val = float(lpa_single.group(1)) * 100_000
        return val, val
    match = re.search(
        r"\$?(\d{2,3})(?:[kK]|,000)?\s*(?:-|to)\s*\$?(\d{2,3})(?:[kK]|,000)?", text
    )
    if match:
        min_val = float(match.group(1))
        max_val = float(match.group(2))
        return (
            min_val * 1000 if min_val < 1000 else min_val,
            max_val * 1000 if max_val < 1000 else max_val,
        )
    return 0.0, 0.0


MAX_JD_CHARS = 10_000

SENIORITY_MAP = {
    "lead": [
        "principal engineer",
        "staff engineer",
        "architect",
        "head of engineering",
        "engineering manager",
        "lead engineer",
    ],
    "senior": ["senior", "sr.", "5+ years", "6+ years", "7+ years", "8+ years"],
    "mid": ["mid level", "mid-level", "2-5 years", "3+ years", "2+ years", "3 years"],
    "junior": [
        "junior",
        "entry level",
        "entry-level",
        "fresher",
        "0-2 years",
        "1+ year",
        "intern",
        "graduate",
    ],
}


def _extract_seniority(text: str) -> str:
    lowered = text.lower()
    for level, keywords in SENIORITY_MAP.items():
        if any(kw in lowered for kw in keywords):
            return level
    return "mid"  # safe default


def parse_jd_text(text: str) -> Dict[str, object]:
    """Parse JD text into the stable dict expected by the scorer."""
    text = (text or "")[:MAX_JD_CHARS]
    required = _split_skill_lines(_extract_section_lines(text, REQUIRED_HEADERS))
    preferred = _split_skill_lines(_extract_section_lines(text, PREFERRED_HEADERS))

    raw_required = list(required)

    tech_hits = _known_skill_hits(text, TECH_SKILLS)
    soft_hits = _known_skill_hits(text, SOFT_SKILLS)

    required = _dedupe(
        [
            skill
            for skill in required
            if skill.lower() in {hit.lower() for hit in tech_hits + soft_hits}
        ]
    )
    preferred = _dedupe(
        [
            skill
            for skill in preferred
            if skill.lower() in {hit.lower() for hit in tech_hits + soft_hits}
        ]
    )

    if not required:
        required = tech_hits[:8] if tech_hits else soft_hits[:6]
    else:
        preferred = _dedupe(
            preferred
            + [
                skill
                for skill in tech_hits
                if skill.lower() not in {item.lower() for item in required}
            ]
        )

    if not raw_required:
        raw_required = list(required)

    target_title = _extract_title(text)
    target_industry = _extract_industry(text)
    if target_industry == DEFAULT_JD["target_industry"]:
        target_industry = _infer_industry_from_context(target_title or "", text[:300])
    # NOTE: all-MiniLM-L6-v2 performs best for tech roles. For non-tech JDs
    # (Sales, Finance, Design), semantic cosine scores will be lower on average.
    # The SOFT_SKILLS keyword matching in coverage scoring compensates partially.
    skills_text = (
        " ".join(_dedupe(required + preferred)) + f" {target_title} {target_industry}"
    )
    salary_min, salary_max = _extract_salary_range(text)

    return {
        "required_skills": required,
        "raw_required_skills": raw_required,
        "preferred_skills": preferred,
        "target_title": target_title,
        "min_experience_years": _extract_experience(text),
        "target_industry": target_industry,
        "target_field": _extract_field(text),
        "skills_text": skills_text.strip() or text,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "seniority_level": _extract_seniority(text),
    }


def parse_jd_docx(path: str) -> Dict[str, object]:
    """Parse a .docx JD. Safe defaults are returned if parsing fails."""
    jd_path = Path(path)
    text = _extract_docx_text(jd_path) if jd_path.exists() else ""
    parsed = parse_jd_text(text)
    for key, value in DEFAULT_JD.items():
        parsed.setdefault(key, value)
    return parsed


def parse_jd(path: str) -> Dict[str, object]:
    """Parse a JD from .docx, .txt, or raw string fallback."""
    jd_path = Path(path)

    if jd_path.exists():
        if jd_path.suffix.lower() == ".docx":
            return parse_jd_docx(path)
        try:
            text = jd_path.read_text(encoding="utf-8")
        except Exception:
            text = ""
    else:
        # If path doesn't exist, treat it as raw text
        text = str(path)

    parsed = parse_jd_text(text)
    for key, value in DEFAULT_JD.items():
        parsed.setdefault(key, value)
    return parsed
