FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd -m appuser
COPY --chown=appuser:appuser . .
USER appuser

ENV PORT=7860
ENV RRR_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
ENV ENV=development

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
