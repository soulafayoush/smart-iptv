# ============================================================
# AI Microservice - Smart IPTV Platform
# ============================================================
# خدمة ذكاء اصطناعي منفصلة (Microservice)
# تُستدعى داخلياً من السيرفر الرئيسي (Node.js)
#
# التقنيات: Python + FastAPI + scikit-learn + Pandas
# ============================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import math
import uvicorn

app = FastAPI(
    title="Smart IPTV - AI Service",
    description="""
    خدمة الذكاء الاصطناعي المنفصلة لمنصة IPTV الذكية

    ## المحركات:
    1. **Recommendation Engine**: TF-IDF + Cosine Similarity (Content-Based Filtering)
    2. **Server Selector**: Multi-factor Scoring Algorithm

    ## ملاحظة:
    هذه الخدمة تُستدعى داخلياً من السيرفر الرئيسي (Node.js)
    وليست مكشوفة مباشرة للمستخدم النهائي.
    """,
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Data Models
# ============================================================

class WatchRecord(BaseModel):
    id: int
    userId: int
    channelId: int
    watchedAt: str
    watchDuration: int
    channel: Dict[str, Any]


class Channel(BaseModel):
    id: int
    title: str
    category: str
    tags: str
    thumbnailUrl: str = ""
    streamUrl: str = ""


class UserRating(BaseModel):
    channelId: int
    score: int


class RecommendRequest(BaseModel):
    user_id: int
    watch_history: List[WatchRecord]
    all_channels: List[Channel]
    ratings: Optional[List[UserRating]] = None
    top_n: int = 10


class RecommendResponse(BaseModel):
    user_id: int
    recommendations: List[int]
    algorithm: str
    count: int
    scores: Optional[List[Dict[str, Any]]] = None


class ServerInfo(BaseModel):
    id: int
    serverName: str
    ipAddress: str
    region: str
    currentLoad: float
    status: str


class SelectServerRequest(BaseModel):
    client_ip: str
    servers: List[ServerInfo]


class SelectServerResponse(BaseModel):
    selected_server: Optional[Dict[str, Any]]
    algorithm: str
    all_scores: Optional[List[Dict[str, Any]]] = None


# ============================================================
# 1. RECOMMENDATION ENGINE (TF-IDF + Cosine Similarity)
# ============================================================

def preprocess_arabic_text(text: str) -> str:
    """
    تنظيف ومعالجة النص العربي:
    - إزالة التشكيل (التندوين)
    - تحويل إلى حروف صغيرة للإنجليزية
    - توحيد المسافات
    """
    # إزالة التشكيل العربي (Tashkeel)
    arabic_diacritics = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]')
    cleaned = arabic_diacritics.sub('', text)
    cleaned = cleaned.lower()
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def build_content_text(channel: Channel) -> str:
    """
    بناء نص ممثل للمحتوى يجمع العنوان والتصنيف والكلمات المفتاحية
    مع إعطاء وزن أكبر للتصنيف (تكراره 3 مرات)
    """
    title = preprocess_arabic_text(channel.title)
    category = preprocess_arabic_text(channel.category)
    tags = preprocess_arabic_text(channel.tags)
    # التصنيف يُكرر لزيادة أهميته
    return f"{title} {category} {category} {category} {tags}"


def build_user_profile_text(history: List[WatchRecord], all_channels: List[Channel]) -> str:
    """
    بناء ملف تعريف المستخدم من سجل مشاهدته.
    القنوات التي شاهدها لفترة أطول تحصل على وزن أكبر.
    """
    channel_map = {ch.id: ch for ch in all_channels}
    parts = []
    for record in history:
        ch = channel_map.get(record.channelId)
        if not ch:
            continue
        # وزن المشاهدة: أكثر مشاهدة = تكرار أكبر في النص
        weight = max(1, int(record.watchDuration / 300))  # كل 5 دقائق = تكرار واحد
        text = build_content_text(ch)
        parts.extend([text] * weight)
    return ' '.join(parts) if parts else ''


@app.post("/ai/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest):
    """
    محرك التوصية - Content-Based Filtering

    ## الخوارزمية:
    1. بناء TF-IDF vectors لجميع القنوات باستخدام scikit-learn
    2. بناء ملف تعريف المستخدم من سجل المشاهدته (مرجح بالمدة)
    3. حساب Cosine Similarity بين ملف المستخدم وكل قناة
    4. إرجاع أعلى N قنوات لم يشاهدها المستخدم

    ## المعادلات:
    - TF-IDF: tf(t,d) × idf(t) = (count/total) × log(N/df)
    - Similarity: cos(A,B) = (A·B) / (||A|| × ||B||)
    """
    try:
        if not req.all_channels:
            return RecommendResponse(
                user_id=req.user_id,
                recommendations=[],
                algorithm="TF-IDF + Cosine Similarity (Content-Based)",
                count=0
            )

        if not req.watch_history:
            # لا يوجد سجل مشاهدة: إرجاع قنوات متنوعة
            selected = [ch.id for ch in req.all_channels[:req.top_n]]
            return RecommendResponse(
                user_id=req.user_id,
                recommendations=selected,
                algorithm="TF-IDF + Cosine Similarity (Content-Based) - No history, returning diverse channels",
                count=len(selected)
            )

        # الخطوة 1: بناء corpus لجميع القنوات
        corpus = []
        channel_ids = []
        for ch in req.all_channels:
            corpus.append(build_content_text(ch))
            channel_ids.append(ch.id)

        # الخطوة 2: بناء TF-IDF باستخدام scikit-learn
        vectorizer = TfidfVectorizer(
            analyzer='word',
            ngram_range=(1, 2),  # unigrams + bigrams
            min_df=1,
            max_df=0.9,
            sublinear_tf=True,  # تطبيع لوغاريتمي لـ TF
        )

        tfidf_matrix = vectorizer.fit_transform(corpus)

        # الخطوة 3: بناء ملف تعريف المستخدم
        user_text = build_user_profile_text(req.watch_history, req.all_channels)
        if not user_text:
            selected = [ch.id for ch in req.all_channels[:req.top_n]]
            return RecommendResponse(
                user_id=req.user_id,
                recommendations=selected,
                algorithm="TF-IDF + Cosine Similarity (Content-Based)",
                count=len(selected)
            )

        user_vector = vectorizer.transform([user_text])

        # الخطوة 4: حساب Cosine Similarity
        similarities = cosine_similarity(user_vector, tfidf_matrix).flatten()

        # الخطوة 5: استبعاد القنوات المشاهودة وترتيب الباقي
        watched_ids = set(h.channelId for h in req.watch_history)

        # بناء خريطة التقييمات لتعزيز التوصيات
        rating_map = {}
        cat_rating_boost = {}
        if req.ratings:
            rating_map = {r.channelId: r.score for r in req.ratings}
            # حساب متوسط تقييم المستخدم لكل تصنيف
            ch_cat_map = {ch.id: ch.category for ch in req.all_channels}
            cat_ratings = {}
            for r in req.ratings:
                cat = ch_cat_map.get(r.channelId)
                if cat:
                    cat_ratings.setdefault(cat, []).append(r.score)
            cat_rating_boost = {
                cat: (sum(scores) / len(scores) - 3) / 10  # normalize: 3=neutral, 5=+0.2
                for cat, scores in cat_ratings.items() if scores
            }

        scored_channels = []
        for i, ch_id in enumerate(channel_ids):
            score = float(similarities[i])
            if ch_id in watched_ids:
                scored_channels.append((ch_id, score * 0.3))
            else:
                # تعزيز بناءً على تقييمات المستخدم لنفس التصنيف
                ch_cat = req.all_channels[i].category if i < len(req.all_channels) else None
                boost = cat_rating_boost.get(ch_cat, 0)
                scored_channels.append((ch_id, score + boost))

        # ترتيب تنازلي
        scored_channels.sort(key=lambda x: x[1], reverse=True)

        # أعلى N
        top_recommendations = scored_channels[:req.top_n]
        recommended_ids = [ch_id for ch_id, _ in top_recommendations]
        scores_detail = [
            {"channel_id": int(ch_id), "score": round(score, 4)}
            for ch_id, score in top_recommendations
        ]

        return RecommendResponse(
            user_id=req.user_id,
            recommendations=recommended_ids,
            algorithm="TF-IDF + Cosine Similarity (Content-Based Filtering) via scikit-learn",
            count=len(recommended_ids),
            scores=scores_detail
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")


# ============================================================
# 2. INTELLIGENT SERVER SELECTOR
# ============================================================

# خرائط المناطق الجغرافية للتقدير
REGION_PROXIMITY = {
    'middle_east': ['middle east', 'dubai', 'riyadh', 'gcc', 'gulf', 'syria', 'lebanon',
                    'jordan', 'iraq', 'saudi', 'uae', 'qatar', 'kuwait', 'bahrain', 'oman'],
    'europe': ['europe', 'germany', 'frankfurt', 'london', 'uk', 'netherlands', 'amsterdam',
               'paris', 'france'],
    'us': ['us', 'usa', 'america', 'new york', 'chicago', 'los angeles', 'dallas'],
    'asia': ['asia', 'singapore', 'hong kong', 'japan', 'tokyo', 'india', 'mumbai'],
}


def estimate_proximity(user_ip: str, server_region: str) -> float:
    """
    تقدير القرب الجغرافي بين IP المستخدم ومنطقة السيرفر
    في الإنتاج: يُستبدل بـ GeoIP database (مثل MaxMind)
    """
    server_lower = server_region.lower()
    for region, keywords in REGION_PROXIMITY.items():
        if any(kw in server_lower for kw in keywords):
            return 0.8 + np.random.uniform(0, 0.2)  # قرب عالي
    return 0.3 + np.random.uniform(0, 0.3)  # قرب منخفض


def estimate_latency(server: ServerInfo) -> float:
    base_latency = 20 + np.random.uniform(0, 30)
    load_penalty = server.currentLoad * 2
    return base_latency + load_penalty


@app.post("/ai/select-server", response_model=SelectServerResponse)
async def select_server(req: SelectServerRequest):
    try:
        if not req.servers:
            return SelectServerResponse(
                selected_server=None,
                algorithm="Multi-factor Scoring (Load + Proximity + Latency)",
                all_scores=[]
            )

        W_LOAD = 0.40
        W_PROXIMITY = 0.35
        W_LATENCY = 0.25

        active_servers = [s for s in req.servers if s.status == 'active']
        if not active_servers:
            return SelectServerResponse(
                selected_server=None,
                algorithm="Multi-factor Scoring",
                all_scores=[]
            )

        # حساب زمن الاستجابة لكل سيرفر
        latencies = {s.id: estimate_latency(s) for s in active_servers}
        max_latency = max(latencies.values()) if latencies else 1

        all_scores = []
        best_server = None
        best_score = -1

        for server in active_servers:
            # العامل 1: الحمل (أقل حمل = أفضل)
            load_score = 1 - (server.currentLoad / 100)

            # العامل 2: القرب الجغرافي
            proximity_score = estimate_proximity(req.client_ip, server.region)

            # العامل 3: سرعة الاستجابة (أقل زمن = أفضل)
            latency = latencies[server.id]
            latency_score = 1 - (latency / max_latency) if max_latency > 0 else 1

            # التقييم النهائي
            total_score = (
                W_LOAD * load_score +
                W_PROXIMITY * proximity_score +
                W_LATENCY * latency_score
            )

            score_detail = {
                "server_id": server.id,
                "server_name": server.serverName,
                "region": server.region,
                "load": server.currentLoad,
                "load_score": round(load_score, 3),
                "proximity_score": round(proximity_score, 3),
                "latency_ms": round(latency, 1),
                "latency_score": round(latency_score, 3),
                "total_score": round(total_score, 4),
            }
            all_scores.append(score_detail)

            print(f"[Server Selector] {server.serverName}: load={server.currentLoad}% "
                  f"prox={proximity_score:.2f} lat={latency:.0f}ms "
                  f"score={total_score:.4f}")

            if total_score > best_score:
                best_score = total_score
                best_server = score_detail

        return SelectServerResponse(
            selected_server=best_server,
            algorithm="Multi-factor Scoring (Load=0.40 + Proximity=0.35 + Latency=0.25)",
            all_scores=all_scores
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server selection error: {str(e)}")


# ============================================================
# Health Check
# ============================================================

@app.get("/ai/health")
async def health_check():
    return {
        "service": "AI Microservice",
        "status": "running",
        "version": "2.0.0",
        "models": ["TF-IDF (scikit-learn)", "Cosine Similarity", "Multi-factor Server Selection"]
    }


# ============================================================
# Entry Point
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("  Smart IPTV - AI Microservice")
    print("  Python + FastAPI + scikit-learn")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=3001)
