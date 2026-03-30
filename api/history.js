// api/history.js - 사용자별 보안 히스토리 조회
import { supabase } from '../lib/supabase';

export default async function handler(request, response) {
    if (request.method !== 'GET') return response.status(405).json({ error: 'GET 전용' });

    // 1. 토큰 검증 (디지털 신분증 확인)
    const authHeader = request.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) return response.status(401).json({ error: '인증 토큰이 누락되었습니다.' });

    if (!supabase) {
        return response.status(500).json({ error: '데이터 서버 연결 오류' });
    }

    try {
        // 서버에서 토큰으로 진짜 사용자 찾기
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error("유효하지 않은 유저 세션");

        const user_id = user.id;
        console.log(`🏙️ [검증완료] 유저 ${user_id}의 히스토리 조회...`);

        // [2] diaries 테이블에서 해당 유저의 데이터만 최신순으로 가져오기
        const { data, error } = await supabase
            .from('diaries')
            .select('*')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const history = data.map(item => ({
            diary: item.content,
            ai_response: item.ai_response,
            date: item.created_at,
            emotion: item.emotion
        }));

        return response.status(200).json({ success: true, history });

    } catch (error) {
        console.error('🔥 보안 히스토리 로딩 에러:', error.message);
        return response.status(403).json({ error: error.message });
    }
}
