import { supabase } from './lib/supabase';

/** 
 * [Architecture: Modular Pattern]
 * 각 역할을 부품(매니저)으로 나누어 관리하는 구조입니다.
 */

// 1. 설정 매니저 (전달값, 주소 등 관리)
const CONFIG = {
    ENDPOINTS: {
        ANALYZE: '/api/analyze',
        HISTORY: '/api/history'
    },
    STORAGE_KEYS: {
        THEME: 'theme'
    },
    ANIMATION_SPEED: 25
};

// 2. 상태 매니저 (유지되는 데이터 관리 - 라이브러리가 아닌 우리만의 로직)
const AppState = {
    theme: localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light',
    user: null,
    history: []
};

// 3. API 서비스 (서버와의 통신 담당)
const ApiService = {
    async analyzeDiary(text) {
        // [New] 현재 로그인한 사용자의 최신 세션 토큰 가져오기
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(CONFIG.ENDPOINTS.ANALYZE, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // [중요] 디지털 신분증 전송
            },
            body: JSON.stringify({ diary: text })
        });
        return await res.json();
    },

    async fetchHistory() {
        // [New] 세션 토큰 가져오기
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`${CONFIG.ENDPOINTS.HISTORY}?t=${Date.now()}`, {
            headers: {
                'Authorization': `Bearer ${token}` // [중요] 디지털 신분증 전송
            }
        });
        return await res.json();
    }
};

// 4. UI 렌더러 (화면에 그리는 일만 담당)
const UIRenderer = {
    elements: {
        // [New] 인증 관련 요소
        authContainer: document.getElementById('auth-container'),
        appContainer: document.getElementById('app-container'),
        authEmail: document.getElementById('auth-email'),
        authPassword: document.getElementById('auth-password'),
        loginBtn: document.getElementById('login-btn'),
        signupBtn: document.getElementById('signup-btn'),
        googleBtn: document.getElementById('google-login-btn'),
        userEmail: document.getElementById('user-email'),
        logoutBtn: document.getElementById('logout-btn'),

        // 기존 요소
        diaryContent: document.getElementById('diary-content'),
        voiceBtn: document.getElementById('voice-btn'),
        analyzeBtn: document.getElementById('analyze-btn'),
        aiResponseBox: document.getElementById('ai-response-box'),
        responseText: document.getElementById('response-text'),
        themeToggle: document.getElementById('theme-toggle'),
        historyList: document.getElementById('history-list')
    },

    toggleView(isLoggedIn) {
        if (isLoggedIn) {
            this.elements.authContainer.classList.add('hidden');
            this.elements.appContainer.classList.remove('hidden');
            this.elements.userEmail.textContent = AppState.user.email;
        } else {
            this.elements.authContainer.classList.remove('hidden');
            this.elements.appContainer.classList.add('hidden');
        }
    },

    // 타이핑 효과 (우리가 만든 유틸리티 함수)
    typeText(element, text) {
        let index = 0;
        element.textContent = '';
        const interval = setInterval(() => {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
            } else { clearInterval(interval); }
        }, CONFIG.ANIMATION_SPEED);
    },

    // 히스토리 카드 생성
    renderHistory(history) {
        if (!history || history.length === 0) {
            this.elements.historyList.innerHTML = '<p class="empty-msg">아직 기록된 일기가 없어요. 오늘 하루를 들려주세요!</p>';
            return;
        }
        this.elements.historyList.innerHTML = '';
        history.forEach(item => {
            const dateStr = new Date(item.date).toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-date">📅 ${dateStr}</span>
                    <span class="card-emotion">✨ ${item.emotion || '분석 중'}</span>
                </div>
                <div class="card-diary">${item.diary}</div>
                <div class="card-ai">${item.ai_response}</div>
            `;
            this.elements.historyList.appendChild(card);
        });
    }
};

// 5. 메인 컨트롤러 (모든 부품을 연결하고 실행)
const App = {
    async init() {
        this.initTheme();
        await this.checkAuth();
        this.bindEvents();
        this.initVoiceRecognition();
    },

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            AppState.user = session.user;
            UIRenderer.toggleView(true);
            this.loadInitialData();
        } else {
            AppState.user = null;
            UIRenderer.toggleView(false);
        }
    },

    initTheme() {
        document.documentElement.setAttribute('data-theme', AppState.theme);
        this.updateThemeIcon();
    },

    bindEvents() {
        // [Auth] 로그인
        UIRenderer.elements.loginBtn.onclick = async () => {
            const email = UIRenderer.elements.authEmail.value;
            const password = UIRenderer.elements.authPassword.value;
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) alert(error.message);
            else location.reload();
        };

        // [Auth] 회원가입
        UIRenderer.elements.signupBtn.onclick = async () => {
            const email = UIRenderer.elements.authEmail.value;
            const password = UIRenderer.elements.authPassword.value;
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) alert(error.message);
            else alert('인증 이메일을 확인해 주세요!');
        };

        // [Auth] 구글 로그인 (OAuth)
        UIRenderer.elements.googleBtn.onclick = async () => {
            console.log("🚀 구글 로그인을 시도합니다...");
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin // 현재 접속 중인 주소로 자동 복귀
                }
            });
            if (error) alert("구글 로그인 실패: " + error.message);
        };

        // [Auth] 로그아웃
        UIRenderer.elements.logoutBtn.onclick = async () => {
            await supabase.auth.signOut();
            location.reload();
        };

        // 분석 버튼 클릭
        UIRenderer.elements.analyzeBtn.addEventListener('click', () => this.handleAnalyze());

        // 테마 토글 클릭
        UIRenderer.elements.themeToggle.addEventListener('click', () => {
            AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', AppState.theme);
            localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, AppState.theme);
            this.updateThemeIcon();
        });
    },

    async handleAnalyze() {
        const text = UIRenderer.elements.diaryContent.value.trim();
        if (!text) return alert('일기 내용이 비어 있습니다. 오늘 하루를 들려주세요!');

        this.setLoading(true);
        try {
            // [New] 이제 ID를 일일이 보내지 않아도 됩니다 (헤더에 Token이 담김)
            const data = await ApiService.analyzeDiary(text);
            if (data.error) throw new Error(data.error);

            UIRenderer.elements.aiResponseBox.classList.remove('hidden');
            UIRenderer.elements.aiResponseBox.classList.add('active');
            UIRenderer.typeText(UIRenderer.elements.responseText, data.response);
            
            setTimeout(() => this.loadInitialData(), 1500);
        } catch (err) {
            alert('분석 에러: ' + err.message);
        } finally {
            this.setLoading(false);
        }
    },

    async loadInitialData() {
        if (!AppState.user) return; // 로그인 안 되어 있으면 중단

        try {
            // [중요] 내 유저 ID로 된 히스토리만 가져옵니다.
            const data = await ApiService.fetchHistory(AppState.user.id);
            AppState.history = data.history;
            UIRenderer.renderHistory(AppState.history);
        } catch (err) { console.error('Data Load Fail:', err); }
    },

    setLoading(isLoading) {
        const btn = UIRenderer.elements.analyzeBtn;
        btn.disabled = isLoading;
        btn.innerHTML = isLoading ? '<span class="icon spinning">⏳</span> 분석 중...' : '<span class="icon">✨</span> 분석하기';
    },

    updateThemeIcon() {
        UIRenderer.elements.themeToggle.querySelector('.icon').innerText = AppState.theme === 'dark' ? '☀️' : '🌙';
    },

    // 음성 인식 초기화
    initVoiceRecognition() {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.onstart = () => { UIRenderer.elements.voiceBtn.innerHTML = '<span class="icon">🔴</span> 소리 듣는 중...'; };
        recognition.onresult = (e) => { UIRenderer.elements.diaryContent.value += e.results[0][0].transcript; };
        recognition.onend = () => { UIRenderer.elements.voiceBtn.innerHTML = '<span class="icon">🎙️</span> 음성 입력'; };

        UIRenderer.elements.voiceBtn.addEventListener('click', () => recognition.start());
    }
};

// 최초 실행
document.addEventListener('DOMContentLoaded', () => App.init());
