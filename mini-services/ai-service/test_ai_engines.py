#!/usr/bin/env python3"""
Unit Tests for AI Engines - Smart IPTV Platform
Run: pytest test_ai_engines.py -v
"""
import pytest
import asyncio
import sys, os

sys.path.insert(0, os.path.dirname(__file__))
from main import (
    preprocess_arabic_text,
    build_content_text,
    build_user_profile_text,
    recommend,
    select_server,
    RecommendRequest,
    Channel,
    WatchRecord,
    SelectServerRequest,
    ServerInfo,
)


def run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def ch_dict(id, title, category, tags):
    return {"id": id, "title": title, "category": category, "tags": tags,
            "thumbnailUrl": "", "streamUrl": ""}


class TestTextPreprocessing:
    def test_remove_diacritics(self):
        text = "\u0642\u064e\u0646\u064e\u0627\u0647\u064f"
        result = preprocess_arabic_text(text)
        assert '\u064e' not in result

    def test_lowercase_conversion(self):
        text = "Hello WORLD NEWS"
        result = preprocess_arabic_text(text)
        assert 'hello' in result
        assert 'world' in result

    def test_normalize_whitespace(self):
        text = "word1    word2    word3"
        result = preprocess_arabic_text(text)
        assert '    ' not in result
        assert result == 'word1 word2 word3'

    def test_empty_string(self):
        result = preprocess_arabic_text('')
        assert result == ''


class TestContentRepresentation:
    def test_category_repeated_3_times(self):
        ch = Channel(id=1, title="Test", category="news", tags="politics")
        text = build_content_text(ch)
        assert text.count('news') == 3

    def test_includes_title(self):
        ch = Channel(id=1, title="Al Jazeera", category="news", tags="politics")
        text = build_content_text(ch)
        assert 'al jazeera' in text

    def test_includes_tags(self):
        ch = Channel(id=1, title="Ch", category="cat", tags="politics economy")
        text = build_content_text(ch)
        assert 'politics' in text and 'economy' in text

    def test_user_profile_weighted_by_duration(self):
        ch1 = Channel(id=1, title='News', category='news', tags='politics')
        ch2 = Channel(id=2, title='Sport', category='sports', tags='football')
        history = [
            WatchRecord(id=1, userId=1, channelId=1, watchedAt='2025-01-01',
                         watchDuration=300, channel=ch_dict(1,'News','news','politics')),
            WatchRecord(id=2, userId=1, channelId=2, watchedAt='2025-01-02',
                         watchDuration=900, channel=ch_dict(2,'Sport','sports','football')),
        ]
        profile = build_user_profile_text(history, [ch1, ch2])
        assert profile.count('sports') > profile.count('news')

    def test_empty_history(self):
        assert build_user_profile_text([], []) == ''


class TestRecommendationEngine:
    @pytest.fixture
    def sample_data(self):
        channels = [
            Channel(id=1, title='Al Jazeera', category='news', tags='politics arabic'),
            Channel(id=2, title='Al Arabiya', category='news', tags='politics economy'),
            Channel(id=3, title='beIN Sports', category='sports', tags='football'),
            Channel(id=4, title='MBC Drama', category='drama', tags='series arabic'),
            Channel(id=5, title='Cartoon', category='kids', tags='animation'),
        ]
        history = [
            WatchRecord(id=1, userId=1, channelId=1, watchedAt='2025-01-01',
                         watchDuration=1800, channel=ch_dict(1,'Al Jazeera','news','politics arabic')),
        ]
        return channels, history

    def test_returns_correct_count(self, sample_data):
        channels, history = sample_data
        req = RecommendRequest(user_id=1, watch_history=history,
                               all_channels=channels, top_n=3)
        result = run_async(recommend(req))
        assert result.count == 3
        assert len(result.recommendations) == 3

    def test_recommends_similar_content(self, sample_data):
        channels, history = sample_data
        req = RecommendRequest(user_id=1, watch_history=history,
                               all_channels=channels, top_n=5)
        result = run_async(recommend(req))
        scores = {s['channel_id']: s['score'] for s in result.scores}
        assert scores[2] > scores.get(4, 0)  # news > drama
        assert scores[2] > scores.get(5, 0)  # news > kids

    def test_empty_history_returns_diverse(self):
        channels = [
            Channel(id=1, title='A', category='news', tags='a'),
            Channel(id=2, title='B', category='sports', tags='b'),
            Channel(id=3, title='C', category='movies', tags='c'),
        ]
        req = RecommendRequest(user_id=99, watch_history=[],
                               all_channels=channels, top_n=3)
        result = run_async(recommend(req))
        assert result.count == 3

    def test_scores_sorted_descending(self, sample_data):
        channels, history = sample_data
        req = RecommendRequest(user_id=1, watch_history=history,
                               all_channels=channels, top_n=5)
        result = run_async(recommend(req))
        scores = [s['score'] for s in result.scores]
        for i in range(len(scores) - 1):
            assert scores[i] >= scores[i + 1]

    def test_algorithm_name(self, sample_data):
        channels, history = sample_data
        req = RecommendRequest(user_id=1, watch_history=history,
                               all_channels=channels, top_n=3)
        result = run_async(recommend(req))
        assert 'scikit-learn' in result.algorithm
        assert 'TF-IDF' in result.algorithm

    def test_watched_channels_penalized(self, sample_data):
        channels, history = sample_data
        req = RecommendRequest(user_id=1, watch_history=history,
                               all_channels=channels, top_n=5)
        result = run_async(recommend(req))
        scores = {s['channel_id']: s['score'] for s in result.scores}
        non_watched = [s for cid, s in scores.items() if cid != 1 and s > 0]
        if non_watched:
            assert scores[1] < max(non_watched)


class TestServerSelection:
    @pytest.fixture
    def servers(self):
        return [
            ServerInfo(id=1, serverName='High-Load', ipAddress='10.0.1.1',
                       region='Dubai', currentLoad=90, status='active'),
            ServerInfo(id=2, serverName='Low-Load', ipAddress='10.0.2.1',
                       region='Dubai', currentLoad=10, status='active'),
            ServerInfo(id=3, serverName='Overloaded', ipAddress='10.0.3.1',
                       region='Frankfurt', currentLoad=95, status='active'),
        ]

    def test_selects_lowest_load(self, servers):
        req = SelectServerRequest(client_ip='192.168.1.1', servers=servers)
        result = run_async(select_server(req))
        assert result.selected_server is not None
        assert result.selected_server['server_name'] == 'Low-Load'

    def test_all_scores_present(self, servers):
        req = SelectServerRequest(client_ip='192.168.1.1', servers=servers)
        result = run_async(select_server(req))
        for score in result.all_scores:
            assert 'load_score' in score
            assert 'proximity_score' in score
            assert 'latency_score' in score
            assert 'total_score' in score

    def test_weights_sum_correctly(self, servers):
        req = SelectServerRequest(client_ip='192.168.1.1', servers=servers)
        result = run_async(select_server(req))
        for s in result.all_scores:
            expected = 0.40 * s['load_score'] + 0.35 * s['proximity_score'] + 0.25 * s['latency_score']
            assert abs(s['total_score'] - expected) < 0.01

    def test_ignores_inactive(self):
        servers = [
            ServerInfo(id=1, serverName='Active', ipAddress='10.0.1.1',
                       region='Dubai', currentLoad=50, status='active'),
            ServerInfo(id=2, serverName='Down', ipAddress='10.0.2.1',
                       region='Frankfurt', currentLoad=5, status='maintenance'),
        ]
        req = SelectServerRequest(client_ip='192.168.1.1', servers=servers)
        result = run_async(select_server(req))
        assert result.selected_server['server_name'] == 'Active'
        assert len(result.all_scores) == 1

    def test_empty_servers(self):
        req = SelectServerRequest(client_ip='192.168.1.1', servers=[])
        result = run_async(select_server(req))
        assert result.selected_server is None

    def test_all_inactive(self):
        servers = [
            ServerInfo(id=1, serverName='D1', ipAddress='10.0.1.1',
                       region='A', currentLoad=10, status='down'),
            ServerInfo(id=2, serverName='D2', ipAddress='10.0.2.1',
                       region='B', currentLoad=10, status='maintenance'),
        ]
        req = SelectServerRequest(client_ip='192.168.1.1', servers=servers)
        result = run_async(select_server(req))
        assert result.selected_server is None

    def test_algorithm_name(self, servers):
        req = SelectServerRequest(client_ip='192.168.1.1', servers=servers)
        result = run_async(select_server(req))
        assert '0.40' in result.algorithm
        assert '0.35' in result.algorithm
        assert '0.25' in result.algorithm


class TestEdgeCases:
    def test_single_channel(self):
        ch = Channel(id=1, title='Ch', category='news', tags='news')
        req = RecommendRequest(user_id=1, watch_history=[],
                               all_channels=[ch], top_n=5)
        result = run_async(recommend(req))
        assert result.count == 1

    def test_single_server(self):
        srv = ServerInfo(id=1, serverName='Only', ipAddress='1.1.1.1',
                          region='Dubai', currentLoad=50, status='active')
        req = SelectServerRequest(client_ip='10.0.0.1', servers=[srv])
        result = run_async(select_server(req))
        assert result.selected_server['server_name'] == 'Only'

    def test_all_channels_watched(self):
        ch = Channel(id=1, title='Ch', category='news', tags='news')
        history = [WatchRecord(id=1, userId=1, channelId=1, watchedAt='2025-01-01',
                              watchDuration=600, channel=ch_dict(1,'Ch','news','news'))]
        req = RecommendRequest(user_id=1, watch_history=history,
                               all_channels=[ch], top_n=5)
        result = run_async(recommend(req))
        assert result.count >= 1

    def test_very_long_duration(self):
        ch = Channel(id=1, title='Ch', category='news', tags='news')
        history = [WatchRecord(id=1, userId=1, channelId=1, watchedAt='2025-01-01',
                              watchDuration=99999, channel=ch_dict(1,'Ch','news','news'))]
        profile = build_user_profile_text(history, [ch])
        assert len(profile) > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
