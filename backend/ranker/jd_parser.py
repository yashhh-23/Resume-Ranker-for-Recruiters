import re
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
}

REQUIRED_HEADERS = ["required", "must have", "mandatory", "essential"]
PREFERRED_HEADERS = ["preferred", "nice to have", "bonus", "good to have", "desired"]

KNOWN_SKILLS = [
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
    "Accounting",
    "Agile",
    "Angular",
    "Apache Flink",
    "BM25",
    "BentoML",
    "CI/CD",
    "CNN",
    "CSS",
    "Computer Vision",
    "Content Writing",
    "Data Pipelines",
    "Data Science",
    "Databricks",
    "Deep Learning",
    "Django",
    "ETL",
    "Elasticsearch",
    "Embeddings",
    "Excel",
    "FAISS",
    "FastAPI",
    "Feature Engineering",
    "Figma",
    "Flask",
    "Forecasting",
    "GANs",
    "Go",
    "GraphQL",
    "HTML",
    "Hadoop",
    "Haystack",
    "Hugging Face Transformers",
    "Illustrator",
    "Image Classification",
    "Information Retrieval",
    "JavaScript",
    "Kubeflow",
    "LangChain",
    "LoRA",
    "MLOps",
    "Machine Learning",
    "Marketing",
    "Microservices",
    "Milvus",
    "MongoDB",
    "Object Detection",
    "OpenCV",
    "OpenSearch",
    "PEFT",
    "Photoshop",
    "Pinecone",
    "PostgreSQL",
    "PowerPoint",
    "Project Management",
    "Prompt Engineering",
    "Qdrant",
    "REST APIs",
    "Recommendation Systems",
    "Redis",
    "Redux",
    "Reinforcement Learning",
    "Rust",
    "SAP",
    "SEO",
    "Sales",
    "Salesforce CRM",
    "Scrum",
    "Sentence Transformers",
    "Six Sigma",
    "Speech Recognition",
    "Spring Boot",
    "Statistical Modeling",
    "TTS",
    "Tailwind",
    "Tally",
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

TITLE_PATTERNS = [
    r"(?:looking for|hiring|role[:\s]+|position[:\s]+|job title[:\s]+)(?:an?\s+)?([A-Z][A-Za-z /+-]*(?:Engineer|Developer|Scientist|Analyst|Manager|Architect|Specialist))",
    r"\b(ML Engineer|Machine Learning Engineer|Data Engineer|Backend Engineer|Frontend Engineer|Full Stack Developer|Data Scientist|Business Analyst|Product Manager)\b",
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
        parts = re.split(r"[,;/|]|\band\b", line)
        for part in parts:
            cleaned = re.sub(r"^[\-•*]\s*", "", part).strip()
            if (
                1 <= len(cleaned.split()) <= 4
                and len(cleaned) <= 32
                and not re.search(r"\b(this|that|beyond|practical|probably|terms|range|used)\b", cleaned, re.IGNORECASE)
            ):
                skills.append(cleaned)
    return _dedupe(skills)


def _known_skill_hits(text: str) -> List[str]:
    hits = []
    lowered = text.lower()
    for skill in KNOWN_SKILLS:
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
    match = re.search(r"(\d+)\+?\s*(?:years?|yrs?)", text, flags=re.IGNORECASE)
    if not match:
        return 0
    return int(match.group(1))


def _extract_industry(text: str) -> str:
    match = re.search(r"(?:industry|domain)[:\s]+([A-Za-z &/-]{3,40})", text, flags=re.IGNORECASE)
    if not match:
        return DEFAULT_JD["target_industry"]
    return match.group(1).strip(" .")


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
    match = re.search(r"\$?(\d{2,3})(?:[kK]|,000)?\s*(?:-|to)\s*\$?(\d{2,3})(?:[kK]|,000)?", text)
    if match:
        min_val = float(match.group(1))
        max_val = float(match.group(2))
        return (min_val * 1000 if min_val < 1000 else min_val,
                max_val * 1000 if max_val < 1000 else max_val)
    return 0.0, 0.0


def parse_jd_text(text: str) -> Dict[str, object]:
    """Parse JD text into the stable dict expected by the scorer."""
    text = text or ""
    required = _split_skill_lines(_extract_section_lines(text, REQUIRED_HEADERS))
    preferred = _split_skill_lines(_extract_section_lines(text, PREFERRED_HEADERS))

    raw_required = list(required)

    known_hits = _known_skill_hits(text)
    required = _dedupe([skill for skill in required if skill.lower() in {hit.lower() for hit in known_hits}])
    preferred = _dedupe([skill for skill in preferred if skill.lower() in {hit.lower() for hit in known_hits}])

    if not required:
        required = known_hits[:8]
    else:
        preferred = _dedupe(preferred + [skill for skill in known_hits if skill.lower() not in {item.lower() for item in required}])

    if not raw_required:
        raw_required = list(required)

    target_title = _extract_title(text)
    target_industry = _extract_industry(text)
    skills_text = " ".join(_dedupe(required + preferred)) + f" {target_title} {target_industry}"
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
    """Parse a JD from .docx or .txt fallback."""
    jd_path = Path(path)
    if jd_path.suffix.lower() == ".txt":
        try:
            text = jd_path.read_text(encoding="utf-8") if jd_path.exists() else ""
        except Exception:
            text = ""
        parsed = parse_jd_text(text)
        for key, value in DEFAULT_JD.items():
            parsed.setdefault(key, value)
        return parsed
    return parse_jd_docx(path)
