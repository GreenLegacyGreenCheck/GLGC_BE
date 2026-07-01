FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# 모델 파일을 빌드 타임에 다운로드 (cold start 지연 방지)
RUN python -c "\
from paddleocr import PaddleOCR, TextRecognition; \
PaddleOCR(lang='korean', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False); \
TextRecognition(model_name='korean_PP-OCRv5_mobile_rec') \
"

ENV PORT=8080
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
