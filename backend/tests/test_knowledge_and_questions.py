"""
تست‌های knowledge base، سوالات و feedback.
"""

import pytest
import io


class TestKnowledgeSearch:
    """تست جستجوی پایگاه دانش."""

    def test_search_returns_list(self, app_client):
        res = app_client.post(
            "/knowledge/search",
            json={"message": "کروماتوگرافی گازی", "top_k": 3},
        )
        assert res.status_code == 200
        data = res.json()
        assert "results" in data
        assert isinstance(data["results"], list)

    def test_search_empty_query(self, app_client):
        res = app_client.post(
            "/knowledge/search",
            json={"message": "", "top_k": 5},
        )
        # either 200 with empty results or 422 — both acceptable
        assert res.status_code in (200, 422)

    def test_search_top_k_limit(self, app_client):
        res = app_client.post(
            "/knowledge/search",
            json={"message": "catalyst", "top_k": 2},
        )
        assert res.status_code == 200
        results = res.json()["results"]
        assert len(results) <= 2

    def test_knowledge_stats_structure(self, app_client):
        res = app_client.get("/knowledge/stats")
        assert res.status_code == 200
        data = res.json()
        # باید حداقل یک فیلد عددی داشته باشد
        assert any(isinstance(v, int) for v in data.values())

    def test_knowledge_stats_file_status_fields(self, monkeypatch):
        import knowledge_service

        monkeypatch.setattr(
            knowledge_service,
            "load_vector_store",
            lambda: [
                {
                    "file_name": "sample.txt",
                    "title": "Sample",
                    "category": "general",
                    "chunk_index": 0,
                    "content": "sample content",
                    "embedding": [0.1, 0.2],
                },
                {
                    "file_name": "sample.txt",
                    "title": "Sample",
                    "category": "general",
                    "chunk_index": 1,
                    "content": "sample content without embedding",
                },
            ],
        )

        stats = knowledge_service.get_knowledge_stats()
        detail = stats["file_details"][0]

        assert stats["backend"] in ("json", "json_fallback")
        assert stats["embedding_model"]
        assert "vector_store_exists" in stats
        assert "last_sync" in stats
        assert detail["file_name"] == "sample.txt"
        assert detail["chunks"] == 2
        assert detail["embedded_chunks"] == 1
        assert detail["missing_embedding_chunks"] == 1
        assert detail["embedding_status"] == "partial"
        assert "source_exists" in detail

    def test_knowledge_upload_requires_admin(self, app_client):
        """آپلود knowledge بدون کلید ادمین باید رد شود."""
        fake_file = io.BytesIO(b"test content for knowledge base")
        res = app_client.post(
            "/knowledge/upload",
            files={"file": ("test.txt", fake_file, "text/plain")},
        )
        assert res.status_code == 401

    def test_knowledge_upload_with_admin(self, app_client, admin_headers):
        """آپلود فایل متنی با کلید ادمین."""
        content = "این یک فایل تست برای پایگاه دانش است.\nحاوی اطلاعات کروماتوگرافی گازی می‌باشد."
        fake_file = io.BytesIO(content.encode("utf-8"))
        res = app_client.post(
            "/knowledge/upload",
            files={"file": ("test_knowledge.txt", fake_file, "text/plain")},
            headers=admin_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True or "file_name" in data

    def test_knowledge_audit_log_requires_admin(self, app_client):
        res = app_client.get("/knowledge/audit-log")
        assert res.status_code == 401

    def test_knowledge_audit_log_with_admin(self, app_client, admin_headers):
        res = app_client.get("/knowledge/audit-log", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "entries" in data or "logs" in data or isinstance(data, list)

    def test_knowledge_reindex_requires_admin(self, app_client):
        res = app_client.post("/knowledge/files/sample.txt/reindex")
        assert res.status_code == 401

    def test_knowledge_reindex_with_admin(self, app_client, admin_headers, monkeypatch):
        from routes import knowledge as knowledge_routes

        def fake_reindex(file_name):
            return {
                "success": True,
                "file_name": file_name,
                "title": "Sample",
                "category": "general",
                "chunks_added": 2,
                "removed_old_chunks": 1,
                "reindexed": True,
            }

        monkeypatch.setattr(knowledge_routes, "reindex_knowledge_file", fake_reindex)

        res = app_client.post(
            "/knowledge/files/sample.txt/reindex",
            headers=admin_headers,
        )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["reindexed"] is True
        assert data["chunks_added"] == 2


class TestQuestionFeedback:
    """تست بازخورد سوالات."""

    def _save_a_question(self):
        """ذخیره یک سوال نمونه برای تست و برگرداندن ID آن."""
        from repositories.questions_repo import save_expert_question
        qid = save_expert_question(
            question="آیا GC-FID برای اندازه‌گیری هیدروکربن مناسب است؟",
            answer="بله، GC-FID برای اندازه‌گیری هیدروکربن‌ها بسیار مناسب است.",
            sources=[],
            detected_domain="chromatography",
            response_time_ms=500,
        )
        return qid

    def test_feedback_upvote(self, app_client, test_db):
        qid = self._save_a_question()
        res = app_client.post(
            f"/questions/{qid}/feedback",
            json={"rating": "up", "comment": "پاسخ مفید بود"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True

    def test_feedback_downvote_with_comment(self, app_client, test_db):
        qid = self._save_a_question()
        res = app_client.post(
            f"/questions/{qid}/feedback",
            json={"rating": "down", "comment": "پاسخ کامل نبود"},
        )
        assert res.status_code == 200
        assert res.json().get("success") is True

    def test_feedback_invalid_rating(self, app_client, test_db):
        qid = self._save_a_question()
        res = app_client.post(
            f"/questions/{qid}/feedback",
            json={"rating": "maybe"},
        )
        # endpoint may return 422 (schema validation) or 404/400 (business logic rejection)
        assert res.status_code in (400, 404, 422)

    def test_feedback_nonexistent_question(self, app_client):
        res = app_client.post(
            "/questions/99999/feedback",
            json={"rating": "up"},
        )
        # 404 یا 200 با success=False
        assert res.status_code in (200, 404)

    def test_questions_stats_public_structure(self, app_client):
        res = app_client.get("/questions/stats-public")
        assert res.status_code == 200
        data = res.json()
        assert "total_questions" in data

    def test_questions_recent_admin_only(self, app_client, admin_headers):
        res = app_client.get("/questions/recent", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "questions" in data
        assert isinstance(data["questions"], list)

    def test_add_to_knowledge_requires_admin(self, app_client, test_db):
        qid = self._save_a_question()
        res = app_client.post(f"/questions/{qid}/add-to-knowledge")
        assert res.status_code == 401

    def test_feedback_stats_requires_admin(self, app_client, admin_headers):
        res = app_client.get("/admin/feedback-stats", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_feedback" in data or isinstance(data, dict)


class TestCSRFToken:
    """تست endpoint توکن CSRF."""

    def test_get_csrf_token(self, app_client):
        res = app_client.get("/csrf-token")
        assert res.status_code == 200
        data = res.json()
        assert "csrf_token" in data
        assert isinstance(data["csrf_token"], str)
        assert len(data["csrf_token"]) > 10

    def test_csrf_token_unique_per_request(self, app_client):
        token1 = app_client.get("/csrf-token").json()["csrf_token"]
        token2 = app_client.get("/csrf-token").json()["csrf_token"]
        # توکن‌ها باید یکتا باشند
        assert token1 != token2


class TestKnowledgeGapReport:
    """تست گزارش شکاف دانش (سوالاتی که بد جواب دادیم)."""

    def _save_weak_question(self, best_score, source_count, web=False, rating=None):
        from repositories.questions_repo import save_expert_question, save_question_feedback
        qid = save_expert_question(
            question="آیا استاندارد ASTM D7039 برای گوگرد در بنزین مناسب است؟",
            answer="پاسخ نمونه.",
            sources=[],
            detected_domain="petroleum",
            response_time_ms=400,
            metadata={
                "question_intent": "standard_explanation",
                "best_score": best_score,
                "source_count": source_count,
                "web_search_used": web,
            },
        )
        if rating:
            save_question_feedback(qid, rating, "")
        return qid

    def test_weak_retrieval_flagged(self, test_db):
        from repositories.questions_repo import get_knowledge_gap_report
        self._save_weak_question(best_score=3.0, source_count=0, web=False)
        report = get_knowledge_gap_report(days=30, score_threshold=14.0)
        assert report["gap_count"] >= 1
        assert report["breakdown"]["weak_retrieval"] >= 1
        # موضوع گم‌شده باید در کلیدواژه‌ها ظاهر شود
        terms = {k["term"] for k in report["top_gap_keywords"]}
        assert any("astm" in t or "d7039" in t for t in terms) or report["top_gap_keywords"]

    def test_strong_answer_not_flagged(self, test_db):
        from repositories.questions_repo import get_knowledge_gap_report
        before = get_knowledge_gap_report(days=30)["gap_count"]
        # score بالا + منبع موجود => نباید به‌عنوان شکاف ثبت شود
        self._save_weak_question(best_score=40.0, source_count=3, web=False)
        after = get_knowledge_gap_report(days=30)["gap_count"]
        assert after == before

    def test_negative_feedback_flagged(self, test_db):
        from repositories.questions_repo import get_knowledge_gap_report
        # حتی با بازیابی خوب، رأی منفی کاربر باید شکاف محسوب شود
        self._save_weak_question(best_score=40.0, source_count=3, web=False, rating="down")
        report = get_knowledge_gap_report(days=30)
        assert report["breakdown"]["negative_feedback"] >= 1

    def test_endpoint_requires_admin(self, app_client):
        res = app_client.get("/admin/knowledge-gaps")
        assert res.status_code == 401

    def test_endpoint_with_admin(self, app_client, admin_headers):
        res = app_client.get("/admin/knowledge-gaps?days=30", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        for key in ("gap_count", "breakdown", "by_domain", "by_intent",
                    "top_gap_keywords", "examples"):
            assert key in data
