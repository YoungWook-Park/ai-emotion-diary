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
    },

    // [New] 채팅 메시지 가져오기 (초기 로딩용)
    async fetchChatMessages() {
        const { data, error } = await supabase
            .from('messages') // [Update] 테이블 명: messages
            .select('*')
            .order('created_at', { ascending: true })
            .limit(50);
        
        if (error) throw error;
        return data;
    },

    // [New] 채팅 메시지 전송
    async sendChatMessage(content, user) {
        const { error } = await supabase
            .from('messages') // [Update] 테이블 명: messages
            .insert([
                { 
                    content: content, 
                    user_email: user.email // [Request] 사용자 이메일 저장 (user_id는 자동 입력됨)
                }
            ]);
        
        if (error) throw error;
    },

    // [Update] 아바타 업로드 및 메타데이터 저장
    async uploadAvatar(file, userId) {
        const filePath = `${userId}/avatar.png`; // [Request] 고유 경로 설정
        
        // 1. Storage 업로드
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });
        
        if (uploadError) throw uploadError;

        // 2. 공개 URL 가져오기
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // 3. 사용자 메타데이터 업데이트
        const { error: updateError } = await supabase.auth.updateUser({
            data: { avatar_url: publicUrl }
        });

        if (updateError) throw updateError;
        return publicUrl;
    },

    // [New] 채팅 이미지 업로드
    async uploadChatImage(file) {
        const fileName = `${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('chat-images')
            .getPublicUrl(fileName);

        return publicUrl;
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
        historyList: document.getElementById('history-list'),

        // [New] 채팅 관련 요소
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),
        chatSendBtn: document.getElementById('chat-send-btn'),
        attachBtn: document.getElementById('attach-btn'),
        chatImageInput: document.getElementById('chat-image-input'),

        // [New] 프로필 관련 요소
        userAvatar: document.getElementById('user-avatar'),
        avatarInput: document.getElementById('avatar-input'),
        changePhotoBtn: document.getElementById('change-photo-btn'),
        avatarWrapper: document.querySelector('.avatar-wrapper')
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
    },

    // [New] 채팅 메시지 렌더링 (KakaoTalk Style + Avatar)
    renderChatMessage(msg, currentUserId) {
        if (!msg || !msg.content) return;

        const emptyMsg = this.elements.chatMessages.querySelector('.empty-msg');
        if (emptyMsg) emptyMsg.remove();

        // 내 메시지인지 확인
        const isMine = msg.user_id === currentUserId || msg.user_email === AppState.user?.email;
        const date = new Date(msg.created_at);
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

        // [New] 아바타 URL 결정 (기본값 설정)
        // 실제 운영시에는 messages 테이블에 avatar_url을 저장하거나 별도의 profiles 테이블이 필요합니다.
        // 여기서는 현재 사용자의 경우 메타데이터를 우선 활용합니다.
        let avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + msg.user_email;
        if (isMine && AppState.user?.user_metadata?.avatar_url) {
            avatarUrl = AppState.user.user_metadata.avatar_url;
        }

        const groupEl = document.createElement('div');
        groupEl.className = `message-group ${isMine ? 'mine' : 'others'}`;
        
        groupEl.innerHTML = `
            <div class="message-content-wrapper">
                ${!isMine ? `<img class="chat-avatar" src="${avatarUrl}" alt="avatar">` : ''}
                <div class="message-data">
                    ${!isMine ? `<div class="message-meta"><span class="user-name">${msg.user_email?.split('@')[0] || '익명'}</span></div>` : ''}
                    <div class="message-bubble-wrapper">
                        <div class="message-bubble">
                            ${this.parseMessageContent(msg.content)}
                        </div>
                        <span class="time">${timeStr}</span>
                    </div>
                </div>
            </div>
        `;
        
        this.elements.chatMessages.appendChild(groupEl);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    },

    // [New] 메시지 내용 파싱 (이미지 여부 확인)
    parseMessageContent(content) {
        const imageRegex = /!\[image\]\((.*?)\)/;
        const match = content.match(imageRegex);

        if (match) {
            const imageUrl = match[1];
            return `<img src="${imageUrl}" class="chat-sent-image" 
                     onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\'error-msg\'>이미지를 불러올 수 없습니다.</span>';" 
                     alt="전송된 이미지">`;
        }
        return content;
    },

    renderChatHistory(messages, currentUserId) {
        this.elements.chatMessages.innerHTML = '';
        if (messages.length === 0) {
            this.elements.chatMessages.innerHTML = '<p class="empty-msg">채팅방에 입장했습니다. 대화를 시작해보세요!</p>';
            return;
        }
        messages.forEach(msg => this.renderChatMessage(msg, currentUserId));
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
            this.loadAvatar(); // [New] 아바타 로드
            this.initRealtimeChat(); // [New] 실시간 채팅 구독 시작
        } else {
            AppState.user = null;
            UIRenderer.toggleView(false);
        }
    },

    // [New] 아바타 로드 함수
    async loadAvatar() {
        if (!AppState.user) return;
        
        // [Update] 메타데이터에 있는 URL을 우선 사용
        const metaUrl = AppState.user.user_metadata?.avatar_url;
        if (metaUrl) {
            UIRenderer.elements.userAvatar.src = `${metaUrl}?t=${Date.now()}`;
        } else {
            // 없는 경우 기본 이미지
            UIRenderer.elements.userAvatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${AppState.user.email}`;
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

        // [New] 채팅 입력 전송 (버튼 클릭)
        UIRenderer.elements.chatSendBtn.addEventListener('click', () => this.handleChatSend());

        // [New] 채팅 입력 전송 (Enter 키)
        UIRenderer.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleChatSend();
        });

        // [New] 이미지 첨부 버튼 클릭
        UIRenderer.elements.attachBtn.onclick = () => UIRenderer.elements.chatImageInput.click();

        // [New] 이미지 선택 시 처리 (업로드 및 전송)
        UIRenderer.elements.chatImageInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // 1. 이미지 업로드
                const imageUrl = await ApiService.uploadChatImage(file);
                
                // 2. 이미지 마크다운 형식으로 메시지 전송
                const imageMarkdown = `![image](${imageUrl})`;
                await ApiService.sendChatMessage(imageMarkdown, AppState.user);
                
                // 입력창 초기화 (파일 선택 초기화)
                UIRenderer.elements.chatImageInput.value = '';
            } catch (err) {
                console.error('Image Upload Error:', err);
                alert('이미지 전송 실패: ' + err.message);
            }
        };

        // 테마 토글 클릭
        UIRenderer.elements.themeToggle.addEventListener('click', () => {
            AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', AppState.theme);
            localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, AppState.theme);
            this.updateThemeIcon();
        });

        // [New] 프로필 사진 변경 클릭
        UIRenderer.elements.changePhotoBtn.onclick = () => UIRenderer.elements.avatarInput.click();
        UIRenderer.elements.avatarWrapper.onclick = () => UIRenderer.elements.avatarInput.click();

        // [New] 사진 선택 시 업로드
        UIRenderer.elements.avatarInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                await ApiService.uploadAvatar(file, AppState.user.id);
                alert('프로필 사진이 변경되었습니다!');
                this.loadAvatar(); // 이미지 새로고침
            } catch (err) {
                console.error('Upload Error:', err);
                alert('사진 업로드 실패: ' + err.message);
            }
        };
    },

    // [New] 실시간 채팅 구독 설정 (강화된 버전)
    initRealtimeChat() {
        // 1. 기존 메시지 로드 (초기 데이터)
        ApiService.fetchChatMessages()
            .then(messages => {
                UIRenderer.renderChatHistory(messages, AppState.user?.id);
            })
            .catch(err => console.error('Chat history Load fail:', err));

        // 2. 실시간 채널 구독
        const chatChannel = supabase.channel('chat-room');
        
        chatChannel
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages'
            }, (payload) => {
                console.log('새 메시지 도착:', payload.new);
                UIRenderer.renderChatMessage(payload.new, AppState.user?.id);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('실시간 채팅 서버 연결 성공');
                }
            });
    },

    // [New] 채팅 전송 처리
    async handleChatSend() {
        const content = UIRenderer.elements.chatInput.value.trim();
        if (!content) return;

        try {
            await ApiService.sendChatMessage(content, AppState.user);
            UIRenderer.elements.chatInput.value = ''; // 성공 시에만 초기화
            // [참고] Realtime 채널에서 INSERT 이벤트를 감지하여 자동으로 화면에 그려줍니다.
        } catch (err) {
            console.error('메시지 전송 실패:', err);
            alert('메시지 전송 중 오류가 발생했습니다.');
        }
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
