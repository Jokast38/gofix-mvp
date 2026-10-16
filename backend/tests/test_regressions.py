"""Regressions found by the October 2026 functional crawl (web + mobile)."""
from tests.conftest import Api


def test_catalog_accepts_empty_filters_sent_by_the_mobile_app():
    for url in ("/catalog/professionals?category_key=&wilaya=&q=&page_size=12&page=1",
                "/catalog/teachers?subject_key=&level_key=&format=&wilaya=&q=&page_size=12&page=1"):
        r = Api().get(url)
        assert r.status_code == 200, (url, r.text)
        assert r.json()["total"] > 0


def test_catalog_wilaya_filter_still_applies():
    all_ = Api().get("/catalog/professionals?page_size=50").json()["total"]
    algiers = Api().get("/catalog/professionals?wilaya=16&page_size=50").json()["total"]
    assert 0 < algiers <= all_
    assert Api().get("/catalog/professionals?wilaya=abc").status_code == 200
