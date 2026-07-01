import io
import os
import re

import numpy as np
import pillow_heif
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageOps
from paddleocr import PaddleOCR, TextRecognition

# 아이폰 HEIC 사진 안전망 (클라이언트가 이미 PNG로 보내지만, 다른 진입 경로 대비)
pillow_heif.register_heif_opener()

app = FastAPI()

_ocr = PaddleOCR(
    lang="korean",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    # mobile det은 빠르지만 관리비 영수증처럼 빽빽한 다컬럼 표에서 인접 셀을
    # 하나의 박스로 합쳐버려 라벨/값이 흩어지는 문제가 확인되어 server로 되돌림.
)
_rec = TextRecognition(model_name="korean_PP-OCRv5_mobile_rec")


@app.on_event("startup")
def _warmup_models():
    # 첫 predict() 호출에는 추론 그래프 빌드 비용이 따로 붙어 1분 이상 걸린다.
    # 서버 기동 시점에 한 번 태워서, 첫 실제 요청이 그 비용을 떠안지 않게 한다.
    dummy = np.zeros((MAX_INPUT_SIDE, round(MAX_INPUT_SIDE * 0.75), 3), dtype=np.uint8)
    list(_ocr.predict(dummy))
    list(_rec.predict(dummy))


# 사용량/요금 영역만 좁게 2차 재인식 대상으로 삼는다. 전체 페이지에 전처리를
# 걸면 한글 라벨("주택용전력" 등)이 깨지는 게 확인됐으므로, 숫자+단위 위주인
# 이 라인들만 크롭 후 업스케일한다.
ANCHOR_PATTERN = re.compile(r"당월|사용량|전기료|가스료|k\s*wh|m\s*3|m\s*³|㎥", re.IGNORECASE)
MAX_ANCHOR_CROPS = int(os.environ.get("OCR_MAX_ANCHOR_CROPS", "8"))
CROP_PADDING_RATIO = float(os.environ.get("OCR_CROP_PADDING_RATIO", "0.4"))
UPSCALE_FACTOR = float(os.environ.get("OCR_UPSCALE_FACTOR", "2.5"))
# 아이폰 고해상도(24MP 이상) 원본을 그대로 server det 모델에 태우면 메모리
# 부족으로 워커가 죽는 게 확인됐다. detection 전에 미리 줄여서 부담을 낮춘다.
MAX_INPUT_SIDE = int(os.environ.get("OCR_MAX_INPUT_SIDE", "2000"))


def _sort_reading_order(texts, scores, boxes):
    indices = sorted(
        range(len(boxes)),
        key=lambda i: (
            round(((boxes[i][1] + boxes[i][3]) / 2) / 25),
            (boxes[i][0] + boxes[i][2]) / 2,
        ),
    )
    return (
        [texts[i] for i in indices],
        [scores[i] for i in indices],
        [boxes[i] for i in indices],
    )


def _refine_anchor_lines(image: Image.Image, texts, scores, boxes):
    matches = [i for i, t in enumerate(texts) if ANCHOR_PATTERN.search(t)]

    for i in matches[:MAX_ANCHOR_CROPS]:
        x_min, y_min, x_max, y_max = boxes[i]
        pad_x = max(int((x_max - x_min) * CROP_PADDING_RATIO), 6)
        pad_y = max(int((y_max - y_min) * CROP_PADDING_RATIO), 6)

        crop_box = (
            max(0, x_min - pad_x),
            max(0, y_min - pad_y),
            min(image.width, x_max + pad_x),
            min(image.height, y_max + pad_y),
        )
        crop = image.crop(crop_box)
        if crop.width == 0 or crop.height == 0:
            continue

        upscaled = crop.resize(
            (round(crop.width * UPSCALE_FACTOR), round(crop.height * UPSCALE_FACTOR)),
            Image.LANCZOS,
        )

        rec_results = list(_rec.predict(np.array(upscaled)))
        if not rec_results:
            continue

        refined_text = rec_results[0]["rec_text"]
        refined_score = float(rec_results[0]["rec_score"])

        if refined_text:
            texts[i] = refined_text
            scores[i] = refined_score

    return texts, scores


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/recognize")
def recognize(image: UploadFile = File(...)):
    raw = image.file.read()

    try:
        pil_image = Image.open(io.BytesIO(raw))
        pil_image.load()
    except Exception:
        raise HTTPException(status_code=400, detail="이미지를 열 수 없습니다.")

    pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")

    if max(pil_image.size) > MAX_INPUT_SIDE:
        scale = MAX_INPUT_SIDE / max(pil_image.size)
        pil_image = pil_image.resize(
            (round(pil_image.width * scale), round(pil_image.height * scale)),
            Image.LANCZOS,
        )

    results = list(_ocr.predict(np.array(pil_image)))
    if not results or len(results[0]["rec_texts"]) == 0:
        return {"text": "", "confidence": 0.0, "words": []}

    res = results[0]
    texts = list(res["rec_texts"])
    scores = [float(s) for s in res["rec_scores"]]
    boxes = [tuple(int(v) for v in b) for b in res["rec_boxes"]]

    texts, scores, boxes = _sort_reading_order(texts, scores, boxes)
    texts, scores = _refine_anchor_lines(pil_image, texts, scores, boxes)

    return {
        "text": "\n".join(texts),
        "confidence": sum(scores) / len(scores),
        "words": [{"text": t, "confidence": s} for t, s in zip(texts, scores)],
    }
