// lib/supabase.js - 서버와 브라우저 환경에 맞는 최적의 키 선택
import { createClient } from '@supabase/supabase-js';

const getEnv = (key) => {
    if (typeof window !== 'undefined') {
        return import.meta.env[`VITE_${key}`] || import.meta.env[`NEXT_PUBLIC_${key}`];
    }
    return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || process.env[`VITE_${key}`];
};

const supabaseUrl = getEnv('SUPABASE_URL');

// [중요] 서버 환경(Node.js)이라면 마스터 키(SERVICE_ROLE_KEY)를 우선 사용합니다.
// 이렇게 해야 백엔드에서 RLS 보안 정책을 통과하여 데이터를 저장할 수 있습니다.
const supabaseKey = (typeof window === 'undefined') 
    ? (getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY'))
    : getEnv('SUPABASE_ANON_KEY');

let supabase;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log(typeof window === 'undefined' ? "🛡️ 서버용 마스터 클라이언트 연결!" : "🏙️ 브라우저용 클라이언트 연결!");
} else {
    console.warn("⚠️ Supabase 환경변수 누락!");
}

export { supabase };
