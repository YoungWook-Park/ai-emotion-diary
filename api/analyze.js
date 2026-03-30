// api/analyze.js - 사용자별 보안 분석 API
import Redis from 'ioredis';
import { supabase } from '../lib/supabase';

let redis;

export default async function handler(request, response) {
    if (request.method !== 'POST') return response.status(405).json({ error: 'POST 전용' });

    // 1. 토큰 검증 및 사용자 식별 (헤더에서 신분증 추출)
    const authHeader = request.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) return response.status(401).json({ error: '인증 토큰이 누락되었습니다.' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        console.error("❌ 토큰 검증 실패:", authError?.message);
        return response.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }

    const user_id = user.id; // 검증된 안전한 유저 ID

    // Redis 게으른 초기화 (환경변수 체크)
    if (!redis && process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL);
    }

    try {
        const { diary } = request.body;
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) throw new Error("GEMINI_API_KEY 가 없습니다.");

        // [1] 가용한 모델 리스트 확인 (생략 - 기존 유지)
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const listData = await listRes.json();
        const candidates = listData.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name) || [];
        const targetModel = candidates.includes('models/gemini-2.5-flash') ? 'models/gemini-2.5-flash' : 
                            candidates.includes('models/gemini-flash-latest') ? 'models/gemini-flash-latest' : candidates[0];

        // [2] 분석 요청
        const analyzeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `너는 따뜻한 심리 상담가야. 한국어 맞춤법을 지켜서 친절하게 답변해줘.
                        답변 형식:
                        감정: [감정요약]
                        [응원메시지]
                        일기: "${diary}"`
                    }]
                }]
            })
        });

        const data = await analyzeRes.json();
        const aiMessage = data.candidates[0].content.parts[0].text;

        // [3] Supabase 저장 (검증된 유저 ID 사용)
        if (supabase) {
            await supabase.from('diaries').insert([
                { user_id, content: diary, ai_response: aiMessage, emotion: aiMessage.split('\n')[0].replace('감정:', '').trim() }
            ]);
        }

        // [4] Redis 사용자별 격리 저장 (New Key Format)
        if (redis) {
            try {
                // 형식: "user:[사용자ID]:diary-[날짜]"
                const diaryId = `user:${user_id}:diary-${Date.now()}`;
                await redis.set(diaryId, JSON.stringify({ diary, ai_response: aiMessage, date: new Date().toISOString() }), 'EX', 604800);
            } catch (err) { console.error("Redis 격리 저장 실패:", err.message); }
        }

        return response.status(200).json({ success: true, response: aiMessage });

    } catch (error) {
        console.error('🔥 에러:', error.message);
        return response.status(500).json({ error: error.message });
    }
}
