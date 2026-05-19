// 이미지 리소스 경로 설정 (환경변수 또는 기본값 사용)
// Vite 환경변수: VITE_ASSETS_BASE_URL (예: https://cdn.example.com/assets)
// 기본값: /assets (로컬 개발 또는 동일 도메인 배포 시)
const getEnvVar = (key, defaultValue) => {
  try {
    return (import.meta.env && import.meta.env[key]) || defaultValue;
  } catch (e) {
    return defaultValue;
  }
};
const ASSETS_BASE_URL = getEnvVar('VITE_ASSETS_BASE_URL', '');
const API_BASE_URL = getEnvVar('VITE_API_BASE_URL', '/api');

// PWA 아이콘 URL (환경변수 또는 기본 경로 사용)
// Vite 빌드 시 public 폴더의 파일들은 루트에 복사됨
const PWA_ICON_192 = getEnvVar('VITE_PWA_ICON_192', './icon-192x192.png');
const PWA_ICON_512 = getEnvVar('VITE_PWA_ICON_512', './icon-512x512.png');

const IMAGE_URLS = {
  EGG_ICON: `${ASSETS_BASE_URL}/base/img/Eggs/000.png`,
  OVAL_CHARM: `${ASSETS_BASE_URL}/custom/img/items/OVALCHARM.webp`,
  RARE_CANDY: `${ASSETS_BASE_URL}/custom/img/items/RARECANDY.webp`,
  MYSTIC_CHARM: `${ASSETS_BASE_URL}/custom/img/items/MYSTICCHARM.webp`,
  AWAKENING_CHARM: `${ASSETS_BASE_URL}/custom/img/items/AWAKENINGCHARM.webp`,
  SHINY_CHARM: `${ASSETS_BASE_URL}/custom/img/items/SHINYCHARM.webp`,
  BRILLIANCE_CHARM: `${ASSETS_BASE_URL}/custom/img/items/BRILLIANCECHARM.webp`,
  MASTERBALL: `${ASSETS_BASE_URL}/custom/img/ui/icon_ball_MASTERBALL.png`,
  POKEBALL: `${ASSETS_BASE_URL}/custom/img/ui/icon_ball_POKEBALL.png`,
  PWA_ICON_192: PWA_ICON_192,
  PWA_ICON_512: PWA_ICON_512
};

// Guest Mode State
// isGuestMode: 사용자가 명시적으로 게스트 모드를 선택한 경우에만 true
window.isGuestMode = false;

// Guest User ID
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000';

// Auth State: 'loading' | 'authenticated' | 'guest' | 'unauthenticated'
// - loading: 인증 상태 확인 중
// - authenticated: 로그인된 상태
// - guest: 게스트 모드로 사용 중
// - unauthenticated: 로그인 필요 (로그인 화면 표시)
window.authState = 'loading';

// 인증 상태 확인 헬퍼 함수
window.isAuthenticated = () => window.authState === 'authenticated';
window.isGuest = () => window.authState === 'guest';
window.isAuthReady = () => window.authState !== 'loading';

// DOM 요소
const authMessage = document.getElementById("authMessage");
const authDiv = document.getElementById("auth");
const contentDiv = document.getElementById("content");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");


// 현재 로그인한 사용자의 UUID (Backend Sync 후)
let currentUserId = null;
let userPokemonList = []; // 사용자 포켓몬 리스트 (네비게이션용)
let currentDisplayStableId = null; // 현재 보고 있는 포켓몬의 정확한 ID (네비게이션용)
let currentDisplayIsShiny = false; // 현재 보고 있는 포켓몬의 shiny 여부 (네비게이션용)
let isCrySoundEnabled = localStorage.getItem('crySoundEnabled') !== 'false'; // 포켓몬 울음소리 설정 (기본값: true)
window.getCurrentUserId = () => currentUserId;

// Helper to get Auth Headers with Firebase ID Token
async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (window.firebaseAuth && window.firebaseAuth.currentUser) {
    try {
      const token = await window.firebaseAuth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.error("Failed to get ID token:", e);
    }
  }
  return headers;
}

// Helper to escape HTML for XSS prevention
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Theme-color 동적 변경 유틸리티
const ORIGINAL_THEME_COLOR = '#CD5C5C';
const MODAL_THEME_COLOR = '#2b000023';
let activeModalCount = 0;

function setThemeColor(color) {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', color);
  }
}

function onModalOpen() {
  activeModalCount++;
  if (activeModalCount === 1) {
    setThemeColor(MODAL_THEME_COLOR);
  }
}

function onModalClose() {
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    setThemeColor(ORIGINAL_THEME_COLOR);
  }
}

// 전역 노출 (pwa.js 등에서 사용)
window.onModalOpen = onModalOpen;
window.onModalClose = onModalClose;

// 로그인 화면 피카츄 스프라이트 초기화
function initAuthPikachuSprite() {
  const authSprite = document.getElementById('auth-sprite');
  if (!authSprite) return;

  // 피카츄 front 이미지 URL (API assets 경로)
  const pikachuImageUrl = `${ASSETS_BASE_URL}/base/img/Front/PIKACHU.png`;

  const img = new Image();
  img.onload = () => {
    const height = img.naturalHeight;
    const width = img.naturalWidth;
    const frames = Math.max(1, Math.round(width / height));

    // 애니메이션 속도 계산
    const ANIMATION_FRAME_DELAY = 90;
    const SPRITE_SPEED = 2;
    let timePerFrame = ((SPRITE_SPEED / 2) * ANIMATION_FRAME_DELAY) / 1000;
    const duration = frames * timePerFrame;

    // 동적 스타일 생성
    const animName = 'auth-pikachu-anim';
    let styleEl = document.getElementById('auth-pikachu-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'auth-pikachu-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @keyframes ${animName} {
        from { background-position: 0 0; }
        to { background-position: -${width}px 0; }
      }
    `;

    // 스프라이트 스타일 적용
    authSprite.style.width = height + 'px';
    authSprite.style.height = height + 'px';
    authSprite.style.backgroundSize = `auto ${height}px`;
    authSprite.style.backgroundImage = `url("${pikachuImageUrl}")`;
    authSprite.style.animation = `${animName} ${duration}s steps(${frames}) infinite`;

    console.log(`✓ Auth Pikachu sprite loaded: ${frames} frames, ${duration.toFixed(2)}s`);
  };
  img.onerror = () => {
    console.error('Failed to load Pikachu sprite for auth screen');
  };
  img.src = pikachuImageUrl;
}

// 페이지 로드 시 피카츄 스프라이트 초기화
document.addEventListener('DOMContentLoaded', () => {
  initAuthPikachuSprite();
});

// Auth Card UI Update Helper
function updateAuthCardUI(state) {
  const logoutBtn = document.getElementById("logoutBtn"); // The card div itself
  const title = document.getElementById("auth-card-title");
  const desc = document.getElementById("auth-card-desc");
  const icon = document.getElementById("auth-card-icon");

  if (!logoutBtn || !title || !desc) return;

  if (state === 'authenticated') {
    title.textContent = "로그아웃";
    desc.textContent = "계정에서 로그아웃";
    // Optional: Change icon to logout icon
    if (icon) {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>`;
    }
  } else {
    // Guest or Unauthenticated -> "Login"
    title.textContent = "로그인";
    desc.textContent = "로그인하여 시작하기";
    if (icon) {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>`;
    }
  }
}

// Firebase Auth 상태 감지 및 백엔드 동기화
function initializeFirebaseListener() {
  if (window.firebaseAuth) {
    console.log("Firebase Auth initialized, registering listener");

    // Enable login button
    if (googleLoginBtn) {
      googleLoginBtn.disabled = false;
      googleLoginBtn.style.opacity = "1";
      googleLoginBtn.style.cursor = "pointer";
    }

    window.firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        window.isGuestMode = false;
        window.authState = 'authenticated';
        console.log("Firebase User detected:", user.uid);
        try {
          // Local API Sync
          const idToken = await user.getIdToken();
          const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              idToken: idToken, // Also send in body as user-management expects it
              email: user.email,
              username: user.displayName
            })
          });

          if (!response.ok) {
            throw new Error(`Sync failed with status: ${response.status}`);
          }

          const data = await response.json();

          if (data && data.success) {
            currentUserId = data.data.userId;
            const isNewUser = data.data.isNewUser;
            console.log("User synced with backend:", currentUserId, "New user:", isNewUser);

            // 게스트 모드 UI 해제
            if (typeof clearGuestModeUI === 'function') {
              clearGuestModeUI();
            }

            authDiv.style.display = "none";
            document.body.style.overflow = '';

            // 신규 사용자인 경우 약관 동의 모달 표시
            if (isNewUser) {
              contentDiv.style.display = "none";
              document.getElementById('terms-modal').style.display = 'flex';
              onModalOpen();
              hideGlobalLoading(); // 약관 모달 표시 시 로딩 종료
            } else {
              // 기존 사용자는 바로 메인 화면 표시
              contentDiv.style.display = "flex";
              // 로그인 후 초기 데이터 로드
              // await loadUserPokemonIcons(); // Lazy load on tab click
              // 홈 화면 즐겨찾기 포켓몬 로드
              loadHomeFavoritePokemon();
              // 오늘 획득한 포켓몬 로드
              loadTodayObtainedPokemon();

              // 서식지 시스템 초기화
              initHabitat();

              // Notify other modules with a slight delay to ensure listeners are ready
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('user-synced', { detail: { userId: currentUserId } }));
                updateAuthCardUI('authenticated');
                // 주간 검증 확인 (로그인 직후)
                checkWeeklyVerificationStatus().then(() => {
                  // 홈탭 미션 카드 및 주간 달성 바 초기화
                  if (typeof initHomeTab === 'function') initHomeTab();
                });
                hideGlobalLoading(); // 로딩 종료
              }, 500);
            }
          } else {
            console.error("Sync failed: No data returned");
            authMessage.textContent = "사용자 동기화 실패";
            hideGlobalLoading(); // 실패 시에도 로딩 종료
          }
        } catch (e) {
          console.error("Sync error:", e);
          hideGlobalLoading(); // 에러 시에도 로딩 종료
        }
      } else {
        console.log("No user logged in");
        currentUserId = null;

        if (window.isGuestMode || window.authState === 'guest') {
          window.authState = 'guest';
          // Guest Mode: Show Content
          authDiv.style.display = "none";
          document.body.style.overflow = '';
          contentDiv.style.display = "flex";

          // Load Dummy Data
          loadUserPokemonIcons();
          // 홈 화면 즐겨찾기 포켓몬 로드
          loadHomeFavoritePokemon();
          // 오늘 획득한 포켓몬 로드
          loadTodayObtainedPokemon();

          // Initialize habitat system for guest mode after DOM is ready
          setTimeout(() => {
            initHabitat();
            // 홈탭 미션 카드 및 주간 달성 바 초기화
            if (typeof initHomeTab === 'function') initHomeTab();
          }, 100);

          // Setup UI for Guest
          const screenTimePreview = document.getElementById('screenTimePreview');
          if (screenTimePreview) {
            screenTimePreview.textContent = '📱 2시간 30분 (예시)';
            screenTimePreview.style.color = '#CD5C5C';
          }

          const logoutBtn = document.getElementById("logoutBtn");
          if (logoutBtn) {
            updateAuthCardUI('guest');
          }

          showToast('체험 모드로 시작합니다.');
          hideGlobalLoading(); // 게스트 모드 로딩 종료
        } else {
          // Explicit Auth Mode: Show Login
          window.authState = 'unauthenticated';
          authDiv.style.display = "flex";
          document.body.style.overflow = 'hidden';
          contentDiv.style.display = "none";
          hideGlobalLoading(); // 로그인 화면 표시 시 로딩 종료
        }
      }
    });
  } else {
    // Max retries: 100 * 100ms = 10 seconds
    if (!window.authInitAttempts) window.authInitAttempts = 0;
    window.authInitAttempts++;

    if (window.authInitAttempts > 100) {
      console.error("Firebase Auth initialization timed out.");
      if (authMessage) authMessage.textContent = "Firebase 초기화 실패. 체험 모드는 이용 가능합니다.";
      window.authState = 'unauthenticated'; // Allow guest mode to proceed
      hideGlobalLoading();
      if (authDiv) authDiv.style.display = "flex";
      return;
    }

    console.log(`Waiting for Firebase Auth to initialize... (${window.authInitAttempts})`);
    setTimeout(initializeFirebaseListener, 100);
  }
}

// Start listening
showGlobalLoading('로딩 중...');
initializeFirebaseListener();

// 스프라이트 애니메이션 관련 데이터
const spriteData = {};


// 포켓몬 데이터를 가져오는 함수 (API 호출)
async function fetchPokemonData(pokemonStableId, isShiny = false) {
  // 인증 상태가 확정될 때까지 대기
  if (!window.isAuthReady()) {
    console.log('Waiting for auth state to be ready...');
    await new Promise(resolve => {
      const checkAuth = setInterval(() => {
        if (window.isAuthReady()) {
          clearInterval(checkAuth);
          resolve();
        }
      }, 100);
      // 최대 5초 대기 후 타임아웃
      setTimeout(() => {
        clearInterval(checkAuth);
        resolve();
      }, 5000);
    });
  }

  const userId = window.getCurrentUserId ? window.getCurrentUserId() : null;

  // API 엔드포인트 결정 (인증 상태에 따라)
  // authenticated 상태이고 userId가 있으면 collection API, 그 외에는 guest API
  const apiBase = (window.isAuthenticated() && userId) ? '/api/collection' : '/api/guest';

  try {
    const queryParams = new URLSearchParams({
      isShiny: !!isShiny
    });

    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/pokemon/${pokemonStableId}?${queryParams}`, { headers });

    if (!response.ok) {
      console.error('포켓몬 데이터 조회 오류:', response.statusText);
      return null;
    }

    const response_data = await response.json();

    if (!response_data || !response_data.success || !response_data.data) {
      console.error('포켓몬을 찾을 수 없습니다:', pokemonStableId);
      return null;
    }

    console.log('포켓몬 데이터 로드 완료:', response_data.data);
    return response_data.data;

  } catch (error) {
    console.error('포켓몬 데이터 가져오기 실패:', error);
    return null;
  }
}

// 배경 이미지 로드 시 fallback 처리
function loadBackgroundWithFallback(backgroundUrl, fallbackUrls) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      resolve(backgroundUrl);
    };

    img.onerror = () => {
      // 첫 번째 fallback 시도
      if (fallbackUrls && fallbackUrls.length > 0 && fallbackUrls[0]) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackUrls[0]);
        fallbackImg.onerror = () => {
          // 두 번째 fallback 시도 (normal.png)
          if (fallbackUrls.length > 1 && fallbackUrls[1]) {
            resolve(fallbackUrls[1]);
          } else {
            resolve(null);
          }
        };
        fallbackImg.src = fallbackUrls[0];
      } else {
        resolve(null);
      }
    };

    img.src = backgroundUrl;
  });
}

// 포켓몬 데이터를 화면에 표시하는 함수
// 설명글이 화면(모달)을 벗어나는지 확인하고 숨기는 함수
function adjustDescriptionVisibility() {
  // 레이아웃 계산을 위해 다음 프레임에 실행
  requestAnimationFrame(() => {
    const container = document.querySelector('.pokemon-detail-content');
    const description = document.querySelector('.pokedex-description');

    if (container && description) {
      // 먼저 보이게 설정하여 높이를 측정할 수 있게 함
      description.style.display = 'block';

      const containerRect = container.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();

      // 설명글의 하단이 컨테이너 하단보다 아래에 있으면 (짤리면) 숨김
      // 5px 정도의 여유를 둠
      if (descriptionRect.bottom > containerRect.bottom + 5) {
        description.style.display = 'none';
      }
    }
  });
}

// 창 크기 변경 시에도 가시성 조정
window.addEventListener('resize', adjustDescriptionVisibility);



// 포켓몬 데이터를 화면에 표시하는 함수
// 포켓몬 데이터를 화면에 표시하는 함수
async function displayPokemon(pokemonStableId, isShiny = false) {
  const flipper = document.getElementById('pokemonFlipper');
  const descEl = document.getElementById('display-description');

  // 1. 즉시 숨김 (이전 포켓몬 잔상 방지)
  if (flipper) flipper.style.opacity = '0';
  if (descEl) descEl.style.opacity = '0';

  // 플리퍼 정면 초기화 (애니메이션 포함)
  if (typeof resetFlipperToFront === 'function') {
    resetFlipperToFront();
  }

  // 현재 표시 중인 포켓몬의 shiny 상태 업데이트 (네비게이션용)
  currentDisplayIsShiny = Boolean(isShiny);

  const pokemonData = await fetchPokemonData(pokemonStableId, isShiny);

  if (!pokemonData) {
    console.error('포켓몬 데이터를 불러올 수 없습니다.');
    return;
  }

  // UI 텍스트 업데이트 (존재하는 경우)
  const nameEl = document.getElementById('display-name');
  // descEl already selected above
  const typesContainer = document.getElementById('display-types');
  const hashtagsContainer = document.getElementById('display-hashtags');

  if (nameEl && pokemonData.pokemon) nameEl.textContent = pokemonData.pokemon.name;
  if (descEl && pokemonData.pokemon) descEl.textContent = pokemonData.pokemon.pokedex;

  // 해시태그 렌더링
  if (hashtagsContainer && pokemonData.pokemon) {
    hashtagsContainer.innerHTML = '';

    // 1. 카테고리 해시태그
    if (pokemonData.pokemon.category) {
      const catTag = document.createElement('span');
      catTag.className = 'hashtag';
      catTag.textContent = `#${pokemonData.pokemon.category}`;
      hashtagsContainer.appendChild(catTag);
    }

    // 2. 서식지 해시태그
    if (pokemonData.pokemon.habitat) {
      const habitatTag = document.createElement('span');
      habitatTag.className = 'hashtag habitat';

      const habitatMap = {
        'grassland': '초원',
        'forest': '숲',
        'watersedge': '물가',
        'sea': '바다',
        'cave': '동굴',
        'mountain': '산',
        'roughterrain': '거친지형',
        'urban': '도시',
        'rare': '희귀'
      };

      const habitatName = habitatMap[pokemonData.pokemon.habitat] || pokemonData.pokemon.habitat;
      habitatTag.textContent = `#${habitatName}`;
      hashtagsContainer.appendChild(habitatTag);
    }

    // 3. 플래그 해시태그 (Legendary, Mythical 등)
    if (pokemonData.pokemon.flags) {
      let flags = pokemonData.pokemon.flags;
      // 문자열로 온 경우 파싱
      if (typeof flags === 'string') {
        try {
          flags = JSON.parse(flags);
        } catch (e) {
          console.error('Flags parse error:', e);
          flags = [];
        }
      }

      if (Array.isArray(flags)) {
        flags.forEach(flag => {
          // 표시하고 싶은 주요 플래그만 필터링하거나, 전체 표시
          // 예: Legendary, Mythical, UltraBeast, Paradox
          const displayFlags = ['Legendary', 'Mythical', 'UltraBeast', 'Paradox'];
          if (displayFlags.includes(flag)) {
            const flagTag = document.createElement('span');
            flagTag.className = `hashtag ${flag.toLowerCase()}`;

            // 한글 매핑 (필요 시)
            const flagMap = {
              'Legendary': '전설',
              'Mythical': '환상',
              'UltraBeast': '울트라비스트',
              'Paradox': '패러독스'
            };

            flagTag.textContent = `#${flagMap[flag] || flag}`;
            hashtagsContainer.appendChild(flagTag);
          }
        });
      }
    }
  }

  if (typesContainer && pokemonData.pokemon) {
    typesContainer.innerHTML = '';
    const types = [];
    if (pokemonData.pokemon.type1) types.push(pokemonData.pokemon.type1);
    if (pokemonData.pokemon.type2) types.push(pokemonData.pokemon.type2);

    types.forEach(type => {
      const typeImg = document.createElement('img');
      const typeClass = getTypeClass(type);
      typeImg.src = `${ASSETS_BASE_URL}/custom/img/ui/${typeClass}.png`;
      typeImg.alt = type;
      typeImg.className = 'type-image';
      typesContainer.appendChild(typeImg);
    });

    // 타입 개수에 따른 위치 보정 (2개일 때 왼쪽으로 더 이동)
    if (types.length > 1) {
      typesContainer.style.left = '4%';
    } else {
      typesContainer.style.left = ''; // CSS 기본값(7%) 사용
    }
  }

  // 즐겨찾기 상태 업데이트
  // 즐겨찾기 상태 업데이트
  const favBtn = document.getElementById('display-favorite-btn');
  if (favBtn) {
    // 기존 리스너 제거를 위해 복제
    const newFavBtn = favBtn.cloneNode(true);
    favBtn.parentNode.replaceChild(newFavBtn, favBtn);

    const emptyHeart = newFavBtn.querySelector('.heart-icon.empty');
    const filledHeart = newFavBtn.querySelector('.heart-icon.filled');

    // 초기 상태 설정
    if (pokemonData.is_favorite) {
      if (emptyHeart) emptyHeart.style.display = 'none';
      if (filledHeart) filledHeart.style.display = 'inline-block';
    } else {
      if (emptyHeart) emptyHeart.style.display = 'inline-block';
      if (filledHeart) filledHeart.style.display = 'none';
    }

    // 클릭 이벤트 추가
    newFavBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (!currentUserId) {
        if (window.isGuest()) {
          showToast('체험 모드에서는 사용할 수 없습니다. 로그인해주세요.');
          return;
        }
        showToast('로그인이 필요합니다.');
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/collection/favorite', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            // userId is extracted from token
            pokemonStableId: pokemonStableId,
            isShiny: isShiny
          })
        });

        if (!response.ok) throw new Error('API Error');

        const result = await response.json();

        if (result.success) {
          const isFav = result.data.is_favorite;

          // UI 업데이트
          if (isFav) {
            if (emptyHeart) emptyHeart.style.display = 'none';
            if (filledHeart) filledHeart.style.display = 'inline-block';
            // 애니메이션 효과
            filledHeart.style.transform = 'scale(1.2)';
            setTimeout(() => filledHeart.style.transform = 'scale(1)', 200);
          } else {
            if (emptyHeart) emptyHeart.style.display = 'inline-block';
            if (filledHeart) filledHeart.style.display = 'none';
          }

          showToast(result.data.message);

          // 데이터 상태 업데이트 (메모리 상)
          pokemonData.is_favorite = isFav;

          // 홈 화면 업데이트 (즐겨찾기 변경 사항 반영)
          loadHomeFavoritePokemon();

        } else {
          throw new Error(result.error || '즐겨찾기 변경 실패');
        }
      } catch (err) {
        console.error('Favorite toggle error:', err);
        showToast('오류가 발생했습니다.');
      }
    });
  }

  // 이로치 상태 업데이트 (UI 표시)
  // 이로치 상태 업데이트 (UI 표시)
  const shinyBtn = document.getElementById('display-shiny-btn');
  if (shinyBtn) {
    // 기존 리스너 제거를 위해 복제
    const newShinyBtn = shinyBtn.cloneNode(true);
    shinyBtn.parentNode.replaceChild(newShinyBtn, shinyBtn);

    // 상태에 따른 스타일 적용
    if (pokemonData.is_shiny) {
      newShinyBtn.style.filter = 'none';
      newShinyBtn.style.opacity = '1';
    } else {
      // 비활성화 시: 흑백 + 약간 어둡게(진한 회색) + 투명도 높임
      newShinyBtn.style.filter = 'grayscale(100%) brightness(0.7)';
      newShinyBtn.style.opacity = '0.8';
    }

    // 클릭 이벤트 추가 (토글 및 해제)
    newShinyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      // 1. 이미 이로치 상태이면 일반으로 돌아가기 (항상 가능)
      if (isShiny) {
        displayPokemon(pokemonStableId, false);
        return;
      }

      // 2. 일반 상태일 때: 이로치 보유 여부 확인
      if (pokemonData.has_shiny) {
        // 보유 중이면 바로 표시
        displayPokemon(pokemonStableId, true);
      } else {
        // 미보유 시: 해제 모달 표시
        const cost = 1;

        // 희귀 포켓몬 여부 확인
        let isRare = false;
        if (pokemonData.pokemon.flags) {
          let flags = pokemonData.pokemon.flags;
          if (typeof flags === 'string') {
            try { flags = JSON.parse(flags); } catch (e) { flags = []; }
          }
          if (Array.isArray(flags)) {
            isRare = flags.some(flag => ['Legendary', 'Mythical', 'UltraBeast', 'Paradox'].includes(flag));
          }
        }

        const requiredItemName = isRare ? 'Brilliance Charm' : 'Shiny Charm';
        const requiredItemNameKo = isRare ? '광휘의 부적' : '빛나는 부적';
        const requiredItemImage = isRare ? IMAGE_URLS.BRILLIANCE_CHARM : IMAGE_URLS.SHINY_CHARM;

        let charmCount = 0;

        // 아이템 보유량 확인
        try {
          showGlobalLoading('정보 확인 중...');
          const headers = await getAuthHeaders();
          const itemsResponse = await fetch('/api/user/items', { headers });
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            if (itemsData.success && itemsData.data[requiredItemName]) {
              charmCount = itemsData.data[requiredItemName].quantity;
            }
          }
        } catch (err) {
          console.error('Failed to fetch items:', err);
        } finally {
          hideGlobalLoading();
        }

        const safeName = escapeHtml(pokemonData.pokemon.name);
        const confirmed = await showConfirmModal(
          '이로치 획득',
          `<div style="text-align: center;">    
             이로치 <strong>${safeName}</strong>를 획득하시겠습니까?<br><br>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0;">
              <img src="${requiredItemImage}" width="32" height="32">
              <span>소모: ${requiredItemNameKo} <strong>${cost}개</strong></span>
            </div>
            <small style="color:#666">(보유: ${charmCount}개)</small>
          </div>`
        );

        if (confirmed) {
          try {
            showGlobalLoading('이로치 해제 중...');
            const headers = await getAuthHeaders();
            const response = await fetch('/api/pokemon/unlock-shiny', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                // userId is extracted from token
                targetPokemonId: pokemonStableId
              })
            });

            const result = await response.json();
            if (result.success) {
              showToast(result.data.message);

              // Refetch evolution data to update the shiny bar and shiny icons in the modal
              let baseImageName = pokemonData.pokemon.image_name;
              // Try to find base_image_name from userPokemonList if available for consistency
              if (typeof userPokemonList !== 'undefined' && Array.isArray(userPokemonList)) {
                const found = userPokemonList.find(p => p.display_stable_id === pokemonStableId || p.pokemon_stable_id === pokemonStableId);
                if (found && found.base_image_name) {
                  baseImageName = found.base_image_name;
                }
              }

              // Call showIconGroupDetail to refresh the entire modal context (evolution tree, shiny bar, and main display)
              // This is more robust than just calling displayPokemon
              await showIconGroupDetail(baseImageName, pokemonStableId, true, navigationContext || 'collection');

              // Background updates
              loadUserPokemonIcons();
              if (typeof loadTodayObtainedPokemon === 'function') loadTodayObtainedPokemon();
              if (window.sleepTracker && typeof window.sleepTracker.loadSleepStatus === 'function') {
                window.sleepTracker.loadSleepStatus();
              }
            } else {
              showToast(result.error || '이로치 해제 실패');
            }
          } catch (err) {
            console.error(err);
            showToast('오류가 발생했습니다.');
          } finally {
            hideGlobalLoading();
          }
        }
      }
    });
  }

  // 회전 버튼 이벤트
  const rotateBtn = document.getElementById('display-rotate-btn');
  if (rotateBtn) {
    const newRotateBtn = rotateBtn.cloneNode(true);
    rotateBtn.parentNode.replaceChild(newRotateBtn, rotateBtn);

    newRotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const flipper = document.getElementById('pokemonFlipper');
      if (flipper) {
        // 현재 회전 각도에 180도 더하기
        currentRotation += 180;
        flipper.style.transition = 'transform 0.6s ease';
        flipper.style.transform = `translate(-50%, -50%) rotateY(${currentRotation}deg)`;
        setTimeout(() => {
          flipper.style.transition = '';
        }, 600);
      }
    });
  }

  // 배경 이미지 설정 (fallback 처리 포함)
  const background = document.getElementById('background');
  if (background && pokemonData.background_image) {
    const validBackgroundUrl = await loadBackgroundWithFallback(
      pokemonData.background_image,
      pokemonData.fallback_backgrounds
    );

    if (validBackgroundUrl) {
      background.style.setProperty('--background-image', `url("${validBackgroundUrl}")`);
      console.log('배경 이미지 로드 완료:', validBackgroundUrl);
    }
  }

  // 스프라이트 설정 (비동기 로드 대기)
  const frontSpeed = pokemonData.pokemon.front_animation_speed !== undefined ? pokemonData.pokemon.front_animation_speed : 2;
  const backSpeed = pokemonData.pokemon.back_animation_speed !== undefined ? pokemonData.pokemon.back_animation_speed : 2;

  await Promise.all([
    setupSprite('sprite-front', pokemonData.front_image, frontSpeed),
    setupSprite('sprite-back', pokemonData.back_image, backSpeed)
  ]);

  // 2. 이미지 로드 완료 후 표시
  // requestAnimationFrame을 사용하여 DOM 업데이트 후 스타일 적용 보장
  requestAnimationFrame(() => {
    if (flipper) flipper.style.opacity = '1';
    if (descEl) descEl.style.opacity = '1';
  });

  // 울음소리 재생
  if (pokemonData.cry_sound && isCrySoundEnabled) {
    const audio = new Audio(pokemonData.cry_sound);
    audio.volume = 0.01;
    audio.play().catch(err => {
      console.error('울음소리 재생 실패:', err);
    });
  }

  // 설명글 가시성 조정
  adjustDescriptionVisibility();

  console.log(`포켓몬 표시 완료: ${pokemonData.pokemon.name} (${pokemonStableId})`);
}

// 로그인 함수
// 구글 로그인 함수
// 구글 로그인 함수
if (googleLoginBtn) {
  // 초기 상태: 비활성화 (Firebase 로드 대기)
  googleLoginBtn.disabled = true;
  googleLoginBtn.style.opacity = "0.5";
  googleLoginBtn.style.cursor = "wait";

  googleLoginBtn.addEventListener("click", () => {
    // 중요: iOS PWA 팝업 차단을 방지하기 위해 비동기(await) 없이 즉시 호출해야 함
    if (!window.firebaseAuth || !window.googleProvider || !window.signInWithPopup) {
      console.warn("Firebase Auth not ready yet");
      return;
    }

    // authMessage.textContent = "Google 로그인 팝업을 띄우는 중..."; // iOS 팝업 차단 방지를 위해 DOM 업데이트 제거

    // 즉시 실행 (Promise 체이닝 사용)
    window.signInWithPopup(window.firebaseAuth, window.googleProvider)
      .then((result) => {
        console.log("Popup login success:", result.user.uid);
        authMessage.textContent = "로그인 성공!";
        // onAuthStateChanged에서 처리됨
      })
      .catch((error) => {
        console.error("Google Login Error:", error);
        authMessage.textContent = "로그인 실패: " + error.message;

        if (error.code === 'auth/popup-blocked') {
          authMessage.textContent = "팝업 차단을 허용하거나 로그인 버튼을 한번 더 눌러주세요.";
        }
      });
  });
}

// 게스트 로그인 (둘러보기)
const guestLoginBtn = document.getElementById("guestLoginBtn");
if (guestLoginBtn) {
  guestLoginBtn.addEventListener("click", async () => {
    console.log("Guest login button clicked");
    try {
      window.isGuestMode = true;
      window.authState = 'guest';

      // 게스트 유저 ID 설정 (DB에 미리 생성된 게스트 유저)
      currentUserId = GUEST_USER_ID;

      authDiv.style.display = "none";
      document.body.style.overflow = '';
      contentDiv.style.display = "flex";

      // 실제 API를 통해 게스트 유저 데이터 로드
      await loadUserPokemonIcons();
      await loadHomeFavoritePokemon();



      // 스크린타임 더미 데이터 설정 (UI상)
      const screenTimePreview = document.getElementById('screenTimePreview');
      if (screenTimePreview) {
        screenTimePreview.textContent = '📱 2시간 30분 (예시)';
        screenTimePreview.style.color = '#CD5C5C';
      }

      // 로그아웃 버튼을 로그인 버튼으로 변경
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        updateAuthCardUI('guest');
      }

      // 게스트 모드 UI 설정 (저장 버튼들 비활성화)
      setupGuestModeUI();

      showToast('체험 모드로 시작합니다.');
    } catch (error) {
      console.error("Guest login error:", error);
      showToast('체험 모드 시작 중 오류가 발생했습니다.');
    }
  });
} else {
  console.error("guestLoginBtn not found in DOM");
}

// 로그아웃 함수
// 로그아웃 함수
logoutBtn.addEventListener("click", async () => {
  if (window.isGuestMode || window.authState === 'guest') {
    window.isGuestMode = false;
    window.authState = 'unauthenticated';
    // Switch to Auth Screen
    authDiv.style.display = "flex";
    document.body.style.overflow = 'hidden';
    contentDiv.style.display = "none";
    return;
  }

  try {
    await window.firebaseSignOut(window.firebaseAuth);
    currentUserId = null;
    window.authState = 'unauthenticated';

    // 탭 상태 및 데이터 초기화 (로그아웃 시)
    resetTabState();

    authMessage.textContent = "로그아웃 되었습니다.";
    // UI 변경은 onAuthStateChanged에서 처리됨
  } catch (e) {
    console.error("Logout error:", e);
  }
});


// 플레이스홀더 이미지 (텍스트 없는 버전)
const placeholderDataUrl =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="%23eeeeee"/></svg>';

// Asset URL 빌더 함수
function buildAssetUrl(category, folder, filename) {
  // category: 'base' or 'custom'
  // folder: e.g., 'img/Icons', 'img/Front'
  // filename: e.g., 'PIKACHU.png'
  return `${ASSETS_BASE_URL}/${category}/${folder}/${filename}`;
}

// 이미지 URL 생성기 (ASSETS_BASE_URL 사용)
function getPokemonImageUrl(imageName, formSuffix, imageType = "icon", isShiny = false) {
  if (!imageName) return placeholderDataUrl;

  // imageType에 따른 폴더 결정
  let folder;
  if (imageType === "icon") {
    folder = isShiny ? "img/Icons shiny" : "img/Icons";
  } else {
    // Front, Back 등
    folder = isShiny ? `img/${imageType} shiny` : `img/${imageType}`;
  }

  const fileName = formSuffix ? `${imageName}${formSuffix}.png` : `${imageName}.png`;

  // buildAssetUrl 함수를 사용하여 올바른 인코딩 적용
  return buildAssetUrl('base', folder, fileName);
}

// 포켓몬 상세 표시 (진화 트리에서 클릭 시)
async function showPokemonDetail(pokemonStableId, formSuffix, isShiny = false) {
  try {
    showLoadingState();
    await displayPokemon(pokemonStableId, isShiny);
  } catch (error) {
    console.error('Error in showPokemonDetail:', error);
    showToast('정보를 불러오는 중 오류가 발생했습니다.');
  } finally {
    hideLoadingState();
  }
}


// 도감 검색 기능
const iconSearchContainer = document.getElementById('iconSearchContainer');
const iconSearchInput = document.getElementById('iconSearchInput');
const iconSearchBtn = document.getElementById('iconSearchBtn');

if (iconSearchBtn && iconSearchInput) {
  iconSearchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = iconSearchContainer.classList.toggle('active');
    if (isActive) {
      iconSearchInput.focus();
    } else {
      // 닫을 때 검색어 초기화
      if (currentFilter.searchQuery) {
        currentFilter.searchQuery = '';
        iconSearchInput.value = '';
        updateUserPokemonIconsUI();
      }
    }
  });

  iconSearchInput.addEventListener('input', (e) => {
    currentFilter.searchQuery = e.target.value;
    updateUserPokemonIconsUI(); // 클라이언트 측 필터링만 수행
  });

  iconSearchInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// 네비게이션 중 중복 호출 방지 플래그
let isNavigating = false;

// 네비게이션 컨텍스트 (어디서 열렸는지)
let navigationContext = null; // 'today', 'collection', 'sleep', null
let todayPokemonList = []; // 오늘 획득한 포켓몬 목록
let sleepPokemonList = []; // 수면 탭의 포켓몬 목록

// 포켓몬 네비게이션 함수
async function navigatePokemon(direction) {
  console.log('=== navigatePokemon called ===');
  console.log('userPokemonList length:', userPokemonList?.length);
  console.log('todayPokemonList length:', todayPokemonList?.length);
  console.log('navigationContext:', navigationContext);
  console.log('currentDisplayStableId:', currentDisplayStableId);

  if (!currentDisplayStableId) return;

  // 중복 호출 방지
  if (isNavigating) {
    console.log('Navigation already in progress, skipping...');
    return;
  }

  // 컨텍스트에 따라 네비게이션 목록 결정
  let navigationList;
  if (navigationContext === 'today') {
    // 오늘 획득한 포켓몬 목록 사용 (display_stable_id 필드 매핑)
    navigationList = (todayPokemonList || []).map(pokemon => ({
      ...pokemon,
      display_stable_id: pokemon.pokemon_stable_id || pokemon.display_stable_id
    }));
    console.log('Using today pokemon list for navigation');
  } else if (navigationContext === 'sleep') {
    // 수면 탭 포켓몬 목록 사용 (display_stable_id 필드 매핑)
    navigationList = (sleepPokemonList || []).map(pokemon => ({
      ...pokemon,
      display_stable_id: pokemon.stable_id || pokemon.display_stable_id,
      base_image_name: pokemon.image_name,
      is_shiny: false  // 수면 탭에서는 항상 일반형으로 표시
    }));
    console.log('Using sleep pokemon list for navigation');
  } else {
    // 도감 컬렉션 목록 사용 (필터 적용)
    if (!userPokemonList || userPokemonList.length === 0) {
      console.log('userPokemonList is empty');
      return;
    }
    navigationList = typeof getFilteredPokemonList === 'function'
      ? getFilteredPokemonList(userPokemonList)
      : userPokemonList;
  }

  console.log('navigationList length:', navigationList.length, 'context:', navigationContext);

  if (navigationList.length === 0) {
    console.log('No pokemon in filtered list');
    return;
  }

  // display_stable_id와 is_shiny로 정확한 현재 위치 찾기
  // shiny 아이콘이 없어서 일반 아이콘으로 표시되더라도, is_shiny 상태가 다르면 다른 항목으로 취급
  const currentIndex = navigationList.findIndex(icon =>
    icon.display_stable_id === currentDisplayStableId &&
    Boolean(icon.is_shiny) === currentDisplayIsShiny
  );
  console.log('currentIndex:', currentIndex, 'is_shiny:', currentDisplayIsShiny);

  if (currentIndex === -1) {
    console.warn('Current pokemon not found in list:', currentDisplayStableId, 'is_shiny:', currentDisplayIsShiny);
    // 리스트 내용 확인
    console.log('navigationList IDs:', navigationList.map(p => ({ id: p.display_stable_id, shiny: p.is_shiny })));
    return;
  }

  let nextIndex = currentIndex + direction;
  if (nextIndex < 0) nextIndex = navigationList.length - 1;
  if (nextIndex >= navigationList.length) nextIndex = 0;

  const nextPokemon = navigationList[nextIndex];
  const currentPokemon = navigationList[currentIndex];

  console.log('currentPokemon:', currentPokemon.display_stable_id, currentPokemon.base_image_name);
  console.log('nextPokemon:', nextPokemon.display_stable_id, nextPokemon.base_image_name);
  console.log('nextIndex:', nextIndex);

  isNavigating = true;

  try {
    // currentDisplayStableId와 currentDisplayIsShiny를 먼저 업데이트 (중요!)
    currentDisplayStableId = nextPokemon.display_stable_id;
    currentDisplayIsShiny = Boolean(nextPokemon.is_shiny);
    console.log('Updated currentDisplayStableId to:', currentDisplayStableId, 'is_shiny:', currentDisplayIsShiny);

    // 동일 진화 체인인지 확인 (base_image_name이 같으면 같은 진화 체인)
    if (currentPokemon.base_image_name === nextPokemon.base_image_name) {
      // 같은 진화 체인 내에서 이동: displayPokemon만 호출
      console.log('Same evolution chain, calling displayPokemon directly');
      await displayPokemon(nextPokemon.display_stable_id, nextPokemon.is_shiny);
    } else {
      // 다른 진화 체인으로 이동: 진화 트리 새로 로드
      console.log('Different evolution chain, calling showIconGroupDetail');
      await showIconGroupDetail(nextPokemon.base_image_name, nextPokemon.display_stable_id, nextPokemon.is_shiny);
    }
  } finally {
    isNavigating = false;
    console.log('=== navigatePokemon completed ===');
  }
}

// 네비게이션 버튼 이벤트 리스너
const prevBtn = document.getElementById('prev-pokemon-btn');
const nextBtn = document.getElementById('next-pokemon-btn');

if (prevBtn) {
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigatePokemon(-1);
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigatePokemon(1);
  });
}

let lastLoadedIconApiEndpoint = null;

// 사용자 포켓몬 아이콘 컬렉션 불러오기 함수 (데이터 로드 담당)
async function loadUserPokemonIcons(forceFetch = false) {
  const grid = document.getElementById('iconCollectionGrid');
  if (!grid) return;

  const contentSection = grid.parentElement;
  let statusMsg = contentSection.querySelector('.icon-status-message');

  if (!statusMsg) {
    statusMsg = document.createElement('div');
    statusMsg.className = 'icon-status-message';
    contentSection.insertBefore(statusMsg, grid);
  }

  try {
    // 로그인 체크
    if (!currentUserId && !window.isGuest()) {
      if (window.authState === 'loading') return;
      statusMsg.textContent = '로그인이 필요합니다.';
      statusMsg.style.display = 'block';
      grid.style.display = 'none';
      return;
    }

    // API 엔드포인트 결정
    const isGenerationSort = currentFilter.sort === 'generation';
    const apiBase = window.isGuest() ? '/api/guest' : '/api/collection';
    const apiEndpoint = isGenerationSort ? `${apiBase}/all-pokemon` : `${apiBase}/icons`;

    // 데이터 패치 여부 결정 (강제 새로고침이거나, 데이터가 없거나, 엔드포인트가 바뀐 경우)
    if (forceFetch || !window.isPokedexLoaded || apiEndpoint !== lastLoadedIconApiEndpoint) {
      console.log('Fetching pokedex icons from:', apiEndpoint);
      const headers = await getAuthHeaders();
      const response = await fetch(apiEndpoint, { headers });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const result = await response.json();
      userPokemonList = result.data || [];
      window.isPokedexLoaded = true;
      lastLoadedIconApiEndpoint = apiEndpoint;
    }

    // UI 업데이트 호출
    updateUserPokemonIconsUI();

  } catch (err) {
    console.error("Error in loadUserPokemonIcons:", err);
    statusMsg.textContent = '오류가 발생했습니다.';
    statusMsg.style.display = 'block';
    grid.style.display = 'none';
  }
}

// 사용자 포켓몬 아이콘 UI 업데이트 함수 (렌더링 담당)
function updateUserPokemonIconsUI() {
  const grid = document.getElementById('iconCollectionGrid');
  if (!grid) return;

  const contentSection = grid.parentElement;
  let statusMsg = contentSection.querySelector('.icon-status-message');
  if (!statusMsg) {
    statusMsg = document.createElement('div');
    statusMsg.className = 'icon-status-message';
    contentSection.insertBefore(statusMsg, grid);
  }

  const icons = userPokemonList || [];
  const isGenerationSort = currentFilter.sort === 'generation';

  if (!icons || icons.length === 0) {
    statusMsg.textContent = '아직 보유한 포켓몬이 없습니다.';
    statusMsg.style.display = 'block';
    grid.style.display = 'none';
    return;
  }

  // 필터 적용 (검색 필터 포함)
  const filteredIcons = typeof getFilteredPokemonList === 'function'
    ? getFilteredPokemonList(icons)
    : icons;

  // 필터 결과가 없는 경우
  if (filteredIcons.length === 0) {
    statusMsg.innerHTML = `
      <div class="no-filter-results">
        <div class="no-filter-results-icon">🔍</div>
        <div class="no-filter-results-text">필터 조건에 맞는 포켓몬이 없습니다.<br>필터를 변경해보세요.</div>
      </div>
    `;
    statusMsg.style.display = 'block';
    grid.style.display = 'none';
    return;
  }

  // 데이터가 있으면 상태 메시지 숨기고 그리드 표시
  statusMsg.style.display = 'none';
  grid.style.display = 'grid';

  // 포켓몬 카드 생성 함수
  const createPokemonCard = (icon, hideProgressBar = false) => {
    const normalPercent = icon.completion_percentage || 0;
    const shinyPercent = icon.total_count > 0 ? (icon.shiny_owned_count / icon.total_count * 100) : 0;

    // 둘 다 100%이고 favorite이 아닐 때만 몬스터볼 아이콘 표시
    let completeIcon = '';
    if (!hideProgressBar && normalPercent >= 100 && shinyPercent >= 100 && !icon.is_favorite) {
      completeIcon = `<div class="progress-complete-icon visible"><img src="${IMAGE_URLS.POKEBALL}" alt="완료"></div>`;
    }

    let favoriteIconHtml = '';
    if (icon.is_favorite) {
      favoriteIconHtml = `<div class="favorite-icon-overlay"><img src="${ASSETS_BASE_URL}/custom/img/ui/favorite.png" alt="Favorite"></div>`;
    }

    // 프로그레스 바 HTML 생성 (100% 완료된 것은 숨김)
    let progressBarHtml = '';
    if (!hideProgressBar) {
      const showNormalBar = normalPercent < 100;
      const showShinyBar = shinyPercent < 100;

      if (showNormalBar) {
        progressBarHtml += `
      <div class="collection-progress-bg">
        <div class="collection-progress-fill" style="--collection-progress-width: ${normalPercent}%;"></div>
      </div>`;
      }

      if (showShinyBar) {
        progressBarHtml += `
      <div class="shiny-progress-bg">
        <div class="shiny-progress-fill" style="--shiny-progress-width: ${shinyPercent}%;"></div>
      </div>`;
      }
    }

    return `
      <div class="pokemon-card pokemon-icon${hideProgressBar ? ' no-progress' : ''}" role="button" tabindex="0"
           aria-label="${icon.name || icon.base_image_name} 아이콘"
           onclick="showIconGroupDetail('${icon.base_image_name}', '${icon.display_stable_id}', ${icon.is_shiny}, 'collection')"
           onkeypress="if(event.key === 'Enter' || event.key === ' ') showIconGroupDetail('${icon.base_image_name}', '${icon.display_stable_id}', ${icon.is_shiny}, 'collection')">
        ${completeIcon}
        ${favoriteIconHtml}
        <div class="pokemon-sprite" data-src="${icon.icon_url}"></div>
        ${progressBarHtml}
      </div>
    `;
  };

  // 렌더링
  let gridContent = '';
  if (isGenerationSort) {
    let currentGeneration = null;
    filteredIcons.forEach(icon => {
      const generation = icon.generation || 1;
      if (generation !== currentGeneration) {
        currentGeneration = generation;
        gridContent += `<div class="generation-divider"><span>${generation}</span></div>`;
      }
      gridContent += createPokemonCard(icon, true);
    });
  } else {
    gridContent = filteredIcons.map(icon => createPokemonCard(icon, false)).join('');
  }

  grid.innerHTML = gridContent;

  // 스프라이트 지연 로드 설정
  grid.querySelectorAll('.pokemon-sprite').forEach(sprite => {
    setupPokemonSprite(sprite);
  });
}

// 진화 트리 스켈레톤 렌더링
function renderEvolutionSkeleton() {
  const diagramDiv = document.getElementById('evolution-diagram');
  if (!diagramDiv) return;

  // 스켈레톤 구조 생성 (3단계 예시)
  let html = '';
  for (let i = 0; i < 3; i++) {
    html += `<div class="evolution-level skeleton-level">
      <div class="forms-column">
        <div class="evolution-pokemon skeleton-wrapper">
          <div class="evolution-skeleton-item skeleton"></div>
          <div class="evolution-skeleton-text skeleton"></div>
        </div>
      </div>
    </div>`;
  }
  diagramDiv.innerHTML = html;
}

// 메인 디스플레이 로딩 상태 표시 (Fade Out)
function showLoadingState() {
  const displayArea = document.querySelector('.pokemon-display-area');
  if (displayArea) {
    displayArea.classList.add('fading');
  }
}

// 메인 디스플레이 로딩 상태 숨김 (Fade In)
function hideLoadingState() {
  const displayArea = document.querySelector('.pokemon-display-area');
  if (displayArea) {
    // 부드러운 전환을 위해 약간의 지연 후 클래스 제거 (선택사항, 여기서는 즉시 제거)
    requestAnimationFrame(() => {
      displayArea.classList.remove('fading');
    });
  }
}

// 글로벌 로딩 오버레이 표시
function showGlobalLoading(message = '잠시만 기다려주세요...') {
  const overlay = document.getElementById('global-loading-overlay');
  const msgEl = overlay.querySelector('.loading-message');
  if (overlay && msgEl) {
    msgEl.textContent = message;
    overlay.classList.add('visible');
  }
}

// 글로벌 로딩 오버레이 숨김
function hideGlobalLoading() {
  const overlay = document.getElementById('global-loading-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

// 아이콘 그룹 상세 보기 - 진화도 다이어그램 표시
// 아이콘 그룹 상세 보기 - 진화도 다이어그램 표시
async function showIconGroupDetail(baseImageName, specificId = null, isShiny = false, context = 'collection') {
  console.log("Icon group clicked:", baseImageName, "specificId:", specificId, "context:", context);

  // 네비게이션 컨텍스트 설정
  if (!isNavigating) {
    navigationContext = context;
  }

  // 현재 포켓몬 ID와 shiny 상태 설정 (네비게이션용)
  // 네비게이션 중일 때는 이미 navigatePokemon에서 설정했으므로 건너뜀
  if (!isNavigating) {
    if (specificId) {
      currentDisplayStableId = specificId;
      currentDisplayIsShiny = Boolean(isShiny);
    } else {
      // specificId가 없을 때는 리스트에서 해당 base_image_name의 첫 번째 항목 사용
      const foundIcon = userPokemonList.find(icon => icon.base_image_name === baseImageName);
      currentDisplayStableId = foundIcon ? foundIcon.display_stable_id : null;
      currentDisplayIsShiny = foundIcon ? Boolean(foundIcon.is_shiny) : false;
    }
  }

  try {
    if (!currentUserId && !window.isGuest()) {
      showToast('로그인이 필요합니다.');
      return;
    }

    // 모달 열기
    const evolutionModal = document.getElementById('evolution-modal');
    if (evolutionModal) {
      evolutionModal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
      onModalOpen();
      // 모달 열릴 때 플리퍼 정면 초기화
      if (typeof resetFlipperToFront === 'function') {
        resetFlipperToFront();
      }
    }

    // 기존 데이터 유지하면서 로딩 상태 표시 (깜빡임 방지)
    showLoadingState();

    // 진화 트리 스켈레톤 표시
    renderEvolutionSkeleton();

    // API 호출 (인증 상태에 따라 결정)
    const apiBase = window.isGuest() ? '/api/guest' : '/api/collection';
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/evolution/${baseImageName}`, { headers });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();
    const evolutionData = result.data;

    if (!evolutionData || !evolutionData.evolution_tree) {
      throw new Error('Invalid data format');
    }

    // 렌더링
    renderEvolutionDiagram(evolutionData);

    // 상세 정보 표시 (첫 번째 폼 기준)
    // 상세 정보 표시: 보유한 포켓몬 중 가장 높은 진화 단계, 폼 변화 우선 표시
    let targetStableId = specificId;
    const levels = evolutionData.evolution_tree.levels;

    if (!targetStableId) {
      // 1. 진화 레벨 역순 탐색 (진화체 우선)
      for (let i = levels.length - 1; i >= 0; i--) {
        const level = levels[i];
        // 2. 폼 역순 탐색 (폼 변화 우선: 보통 기본형이 먼저 오고 폼이 뒤에 오므로 역순이 폼 우선)
        for (let j = level.forms.length - 1; j >= 0; j--) {
          const form = level.forms[j];
          if (form.is_owned) {
            targetStableId = form.stable_id;
            break;
          }
        }
        if (targetStableId) break;
      }

      // fallback: 보유한 게 없으면(오류?) 기본형 표시
      if (!targetStableId && levels.length > 0 && levels[0].forms.length > 0) {
        targetStableId = levels[0].forms[0].stable_id;
      }
    }

    if (targetStableId) {
      // 메인 포켓몬 표시 (비동기 실행)
      // displayPokemon이 UI 텍스트도 업데이트함
      await displayPokemon(targetStableId, !!isShiny);
    }



    // 회전 버튼 이벤트 (한 번만 등록되도록 수정 필요하지만, 현재 구조상 매번 등록해도 큰 문제는 없음. 
    // 다만 중복 등록 방지를 위해 기존 리스너 제거가 필요할 수 있음.
    // 여기서는 간단히 기존 로직 유지)
    const rotateBtn = document.getElementById('display-rotate-btn');
    if (rotateBtn) {
      const newRotateBtn = rotateBtn.cloneNode(true);
      rotateBtn.parentNode.replaceChild(newRotateBtn, rotateBtn);
      newRotateBtn.addEventListener('click', () => {
        const flipper = document.getElementById('pokemonFlipper');
        if (flipper) {
          // 현재 회전 각도에 180도 더하기
          currentRotation += 180;
          flipper.style.transition = 'transform 0.6s ease';
          flipper.style.transform = `translate(-50%, -50%) rotateY(${currentRotation}deg)`;
          setTimeout(() => {
            flipper.style.transition = '';
          }, 600);
        }
      });
    }

  } catch (err) {
    console.error("Error loading evolution details:", err);
    showToast('상세 정보를 불러오는 중 오류가 발생했습니다.');
    if (document.getElementById('evolution-diagram')) {
      document.getElementById('evolution-diagram').innerHTML = '<div style="text-align:center; color:red;">오류 발생</div>';
    }
  } finally {
    hideLoadingState();
  }
}

// 타입 이름을 CSS 클래스명으로 변환하는 헬퍼 함수
function getTypeClass(typeName) {
  const typeMap = {
    '풀': 'grass',
    '독': 'poison',
    '불꽃': 'fire',
    '물': 'water',
    '벌레': 'bug',
    '노말': 'normal',
    '비행': 'flying',
    '전기': 'electric',
    '땅': 'ground',
    '페어리': 'fairy',
    '격투': 'fighting',
    '에스퍼': 'psychic',
    '바위': 'rock',
    '강철': 'steel',
    '얼음': 'ice',
    '고스트': 'ghost',
    '드래곤': 'dragon',
    '악': 'dark'
  };
  return typeMap[typeName] || 'normal';
}

// 타입 영문명을 한글로 변환하는 헬퍼 함수
function getKoreanType(typeEng) {
  const map = {
    'grass': '풀',
    'poison': '독',
    'fire': '불꽃',
    'water': '물',
    'bug': '벌레',
    'normal': '노말',
    'flying': '비행',
    'electric': '전기',
    'ground': '땅',
    'fairy': '페어리',
    'fighting': '격투',
    'psychic': '에스퍼',
    'rock': '바위',
    'steel': '강철',
    'ice': '얼음',
    'ghost': '고스트',
    'dragon': '드래곤',
    'dark': '악'
  };
  return map[typeEng] || typeEng;
}

// 진화도 다이어그램 렌더링
function renderEvolutionDiagram(data) {
  const { evolution_tree, completion } = data;

  // 진행 바
  const progressBar = document.getElementById('evolution-progress-bar');
  const progressPercentage = document.getElementById('evolution-progress-percentage');
  progressBar.style.width = `${completion.completion_percentage}%`;
  progressBar.className = `progress-bar ${completion.is_complete ? 'complete' : ''}`;
  if (progressPercentage) {
    progressPercentage.textContent = `${Math.round(completion.completion_percentage)}%`;
  }

  // 이로치 진행 바
  const shinyBar = document.getElementById('evolution-shiny-bar');
  const shinyPercentage = document.getElementById('evolution-shiny-percentage');
  if (shinyBar && shinyPercentage) {
    const shinyPercent = completion.total_count > 0 ? (completion.shiny_owned_count / completion.total_count * 100) : 0;
    shinyBar.style.width = `${shinyPercent}%`;
    shinyPercentage.textContent = `${Math.round(shinyPercent)}%`;
  }

  // 진화 다이어그램 렌더링
  const diagramDiv = document.getElementById('evolution-diagram');
  diagramDiv.innerHTML = '';

  // 각 레벨의 폼 인덱스를 추적하기 위한 맵 (image_name + form_suffix -> 인덱스)
  const formIndexMap = new Map();

  // 보유 중인 포켓몬의 ImageName -> StableId 맵핑 (진화 시 부모 ID 찾기용)
  const ownedPokemonMap = new Map();

  // 보유 중인 포켓몬의 StableId 집합 (빠른 조회용)
  const ownedStableIds = new Set();

  // 1차 순회: 보유 포켓몬 맵핑 생성
  evolution_tree.levels.forEach(level => {
    level.forms.forEach(form => {
      if (form.is_owned) {
        ownedStableIds.add(form.stable_id);
        // image_name 사용 (backend에서 전달됨)
        const imageName = form.image_name;
        // 기본형(suffix가 없는 경우) 우선 저장, 아니면 덮어쓰기 (진화는 보통 기본형에서 하므로)
        if (!form.form_suffix || !ownedPokemonMap.has(imageName)) {
          ownedPokemonMap.set(imageName, form.stable_id);
        }
        // stable_id도 키로 추가 (pre_evolution_pokemon이 stable_id를 반환하므로)
        ownedPokemonMap.set(form.stable_id, form.stable_id);
      }
    });
  });

  console.log('Owned Pokemon Map:', Object.fromEntries(ownedPokemonMap));

  evolution_tree.levels.forEach((level, levelIndex) => {
    const levelDiv = document.createElement('div');
    levelDiv.className = 'evolution-level';

    // 폼들을 세로로 나열
    const formsColumn = document.createElement('div');
    formsColumn.className = 'forms-column';

    level.forms.forEach((form, formIndex) => {
      const pokemonDiv = document.createElement('div');
      // owned 클래스는 보유 시, unlockable은 해금 가능 시
      // Restore 'not-owned' class logic
      pokemonDiv.className = `evolution-pokemon ${form.is_owned ? 'owned' : 'not-owned'}`;

      pokemonDiv.setAttribute('data-level', levelIndex);
      pokemonDiv.setAttribute('data-form-index', formIndex);

      // image_name 사용
      const imageName = form.image_name;
      pokemonDiv.setAttribute('data-image-name', imageName);
      pokemonDiv.setAttribute('data-form-suffix', form.form_suffix || '');

      // 폼 위치 추적
      const formKey = `${imageName}${form.form_suffix || ''}`;
      formIndexMap.set(formKey, { levelIndex, formIndex });

      // 이로치 아이콘 (보유 시)
      if (form.is_shiny_owned) {
        const shinyIcon = document.createElement('div');
        shinyIcon.className = 'shiny-icon';
        shinyIcon.textContent = '✨';

        shinyIcon.style.position = 'absolute';

        shinyIcon.style.width = '1.25rem';
        shinyIcon.style.height = '1.25rem';
        shinyIcon.style.display = 'flex';
        shinyIcon.style.alignItems = 'center';
        shinyIcon.style.justifyContent = 'center';
        shinyIcon.style.top = '-0.125rem'; // Slightly adjusted position
        shinyIcon.style.right = '-0.125rem';
        shinyIcon.style.zIndex = '10';
        shinyIcon.style.color = '#F59E0B'; // Gold color
        shinyIcon.style.fontSize = '0.875rem'; // 카드 크기에 맞춰 사이즈 조정
        shinyIcon.style.cursor = 'pointer';
        shinyIcon.title = '이로치 보기';

        shinyIcon.onclick = (e) => {
          e.stopPropagation();
          showPokemonDetail(form.stable_id, '', true);
        };

        pokemonDiv.appendChild(shinyIcon);
      }

      // 클릭 이벤트 및 상태 처리
      if (form.is_owned) {
        pokemonDiv.onclick = () => showPokemonDetail(form.stable_id, '', false);
      } else {
        // 미보유 상태: 진화 가능 여부 또는 폼 해제 가능 여부 확인
        let canEvolve = false;
        let canUnlockForm = false;
        let preEvoStableId = null;

        // 1. 진화 가능 확인
        if (form.pre_evolution_pokemon) {
          const hasPreEvo = ownedPokemonMap.has(form.pre_evolution_pokemon);
          console.log(`Checking evolution for ${form.name} (${imageName}): Pre-Evo=${form.pre_evolution_pokemon}, Owned=${hasPreEvo}`);
          if (hasPreEvo) {
            canEvolve = true;
            preEvoStableId = ownedPokemonMap.get(form.pre_evolution_pokemon);
          }
        }

        // 2. 폼 해제 가능 확인 (기본형 보유 시)
        // 조건: 폼 서픽스가 있고, 해당 포켓몬의 기본형(image_name)을 보유하고 있음
        if (form.form_suffix && ownedPokemonMap.has(imageName)) {
          canUnlockForm = true;

          // 추가 검증: 폼 이름(괄호 안 내용)이 일치하는 전 단계 포켓몬이 존재하는지 확인
          // 예: "윈디 (히스이의 모습)"인 경우, 전 단계인 가디 중에 "가디 (히스이의 모습)"이 있는지 확인
          const match = form.name.match(/\((.*?)\)/);
          if (match) {
            const formType = match[1]; // 예: "히스이의 모습"

            // 현재 레벨에서 기본형(suffix 없는 것)을 찾아 진화 전 정보 확인
            const baseForm = level.forms.find(f => f.image_name === imageName && !f.form_suffix);

            if (baseForm && baseForm.pre_evolution_pokemon) {
              const preEvoImageName = baseForm.pre_evolution_pokemon;

              // 전체 트리에서 진화 전 포켓몬이 있는 레벨 찾기
              let preEvoLevel = null;
              for (const l of evolution_tree.levels) {
                if (l.forms.some(f => f.image_name === preEvoImageName)) {
                  preEvoLevel = l;
                  break;
                }
              }

              if (preEvoLevel) {
                // 진화 전 포켓몬들 중 같은 폼 이름(괄호 포함)을 가진 폼 찾기
                const targetPreForm = preEvoLevel.forms.find(f => f.name.includes(`(${formType})`));

                if (targetPreForm) {
                  // 매칭되는 전 단계 폼이 존재함 -> 해당 폼을 보유하고 있어야 함
                  if (!ownedStableIds.has(targetPreForm.stable_id)) {
                    canUnlockForm = false;
                    console.log(`폼 해제 불가: ${form.name}은(는) ${targetPreForm.name}이(가) 필요합니다.`);
                  }
                }
              }
            }
          }
        }

        if (canEvolve) {
          pokemonDiv.classList.add('unlockable');

          // 희귀한 포켓몬 여부 확인 (Legendary, Mythical, UltraBeast, Paradox)
          const isRarePokemon = form.flags && (
            form.flags.includes('Legendary') ||
            form.flags.includes('Mythical') ||
            form.flags.includes('UltraBeast') ||
            form.flags.includes('Paradox')
          );

          // 비용: 레벨 1 -> 1개, 레벨 2 -> 2개 (레벨 인덱스 사용)
          // 단, levelIndex가 0이면 진화가 아님.
          // 희귀한 포켓몬은 3개
          const cost = isRarePokemon ? 3 : levelIndex;

          // 진화 아이콘 표시 (선택사항)
          const badge = document.createElement('div');
          badge.className = 'unlock-badge evolution';
          badge.innerHTML = `<img src="${IMAGE_URLS.RARE_CANDY}" alt="진화" style="width:100%; height:100%;">`;
          pokemonDiv.appendChild(badge);

          pokemonDiv.onclick = (e) => {
            e.stopPropagation();
            // baseImageName은 그룹의 기준이 되는 이름 (보통 첫 번째 레벨의 첫 번째 폼의 이미지 이름)
            const rootImageName = evolution_tree.levels[0].forms[0].stable_id.replace(/_.*$/, '');
            handleEvolutionClick(preEvoStableId, form.stable_id, form.name, cost, rootImageName);
          };
        } else if (canUnlockForm) {
          pokemonDiv.classList.add('unlockable');

          // 희귀한 포켓몬 여부 확인 (Legendary, Mythical, UltraBeast, Paradox)
          const isRarePokemon = form.flags && (
            form.flags.includes('Legendary') ||
            form.flags.includes('Mythical') ||
            form.flags.includes('UltraBeast') ||
            form.flags.includes('Paradox')
          );
          const itemImage = isRarePokemon ? IMAGE_URLS.AWAKENING_CHARM : IMAGE_URLS.MYSTIC_CHARM;
          const itemAlt = isRarePokemon ? "각성" : "폼 해제";

          // 폼 해제 아이콘 표시
          const badge = document.createElement('div');
          badge.className = 'unlock-badge form';
          badge.innerHTML = `<img src="${itemImage}" alt="${itemAlt}" style="width:100%; height:100%;">`;
          pokemonDiv.appendChild(badge);

          pokemonDiv.onclick = (e) => {
            e.stopPropagation();
            const rootImageName = evolution_tree.levels[0].forms[0].stable_id.replace(/_.*$/, '');
            handleFormUnlockClick(form.stable_id, form.name, rootImageName, isRarePokemon);
          };
        } else {
          pokemonDiv.classList.add('locked');
          pokemonDiv.onclick = () => {
            // 잠김 메시지
            // alert('아직 획득할 수 없습니다.');
          };
        }
      }

      // 아이콘 이미지
      const spriteDiv = document.createElement('div');
      spriteDiv.className = 'pokemon-sprite';
      spriteDiv.setAttribute('data-src', form.icon_url);
      spriteDiv.setAttribute('data-fallback-image', form.image_name);
      spriteDiv.setAttribute('data-fallback-suffix', form.form_suffix || '');

      pokemonDiv.appendChild(spriteDiv);

      // 포켓몬 이름
      const nameDiv = document.createElement('div');
      nameDiv.className = 'pokemon-name';
      nameDiv.textContent = form.name;
      pokemonDiv.appendChild(nameDiv);

      // 이전 진화 정보가 있으면 화살표 표시 (첫 레벨 제외)
      if (levelIndex > 0 && (form.pre_evolution_pokemon || form.pre_evolution_form_suffix)) {
        const arrowDiv = document.createElement('div');
        arrowDiv.className = 'evolution-arrow-indicator';
        arrowDiv.setAttribute('data-pre-evolution-pokemon', form.pre_evolution_pokemon || '');
        arrowDiv.setAttribute('data-pre-evolution-form', form.pre_evolution_form_suffix || '');
        pokemonDiv.appendChild(arrowDiv);
      }

      formsColumn.appendChild(pokemonDiv);
    });

    levelDiv.appendChild(formsColumn);
    diagramDiv.appendChild(levelDiv);
  });

  // 모든 pokemon-sprite 요소에 애니메이션 적용
  diagramDiv.querySelectorAll('.pokemon-sprite').forEach(sprite => {
    setupPokemonSprite(sprite);
  });

  // 화살표 그리기 (모든 레벨이 렌더링된 후)
  // setTimeout(() => {
  //   drawEvolutionArrows(diagramDiv, formIndexMap);
  // }, 100);

}

// 홈 화면용 포켓몬 표시 함수
async function displayHomePokemon(pokemonStableId, isShiny = false) {
  console.log('displayHomePokemon called:', pokemonStableId, isShiny);
  const container = document.getElementById('home-pokemon-container');
  const flipper = document.getElementById('home-pokemon-flipper');

  if (!container || !flipper) {
    console.error('Home pokemon container or flipper not found');
    return;
  }

  // 1. 즉시 숨김 (잔상 방지)
  flipper.style.opacity = '0';

  // 플리퍼 정면 초기화
  flipper.style.transform = 'translate(-50%, -50%) rotateY(0deg)';

  const pokemonData = await fetchPokemonData(pokemonStableId, isShiny);

  if (!pokemonData) {
    console.warn('No pokemon data found for home display');
    container.style.display = 'none';
    return;
  }

  console.log('Home pokemon data loaded:', pokemonData.pokemon.name);

  // 컨테이너 표시
  container.style.display = 'flex';


  // 배경 이미지 설정
  const background = document.getElementById('home-background');
  if (background && pokemonData.background_image) {
    const validBackgroundUrl = await loadBackgroundWithFallback(
      pokemonData.background_image,
      pokemonData.fallback_backgrounds
    );
    if (validBackgroundUrl) {
      background.style.setProperty('--background-image', `url("${validBackgroundUrl}")`);
    }
  }

  // 스프라이트 설정
  const frontSpeed = pokemonData.pokemon.front_animation_speed !== undefined ? pokemonData.pokemon.front_animation_speed : 2;
  const backSpeed = pokemonData.pokemon.back_animation_speed !== undefined ? pokemonData.pokemon.back_animation_speed : 2;

  console.log('Setting up home sprites...');
  await Promise.all([
    setupSprite('home-sprite-front', pokemonData.front_image, frontSpeed),
    setupSprite('home-sprite-back', pokemonData.back_image, backSpeed)
  ]);
  console.log('Home sprites setup complete');

  // 이미지 로드 완료 후 표시
  requestAnimationFrame(() => {
    flipper.style.opacity = '1';
  });

}

// 홈 화면 즐겨찾기 목록 및 인덱스
let homeFavorites = [];
let currentHomeIndex = 0;

// 홈 화면 포켓몬 네비게이션
async function navigateHomePokemon(direction) {
  if (!homeFavorites || homeFavorites.length <= 1) return;

  currentHomeIndex += direction;

  // 순환 처리
  if (currentHomeIndex < 0) currentHomeIndex = homeFavorites.length - 1;
  if (currentHomeIndex >= homeFavorites.length) currentHomeIndex = 0;

  const nextPokemon = homeFavorites[currentHomeIndex];
  await displayHomePokemon(nextPokemon.pokemon_stable_id, nextPokemon.is_shiny);
}

// 홈 화면에 최근 즐겨찾기 포켓몬 로드
async function loadHomeFavoritePokemon() {
  console.log('loadHomeFavoritePokemon called');
  // 게스트 모드일 때도 로드해야 함
  if (!currentUserId && !window.isGuest()) {
    console.log('No current user and not guest, skipping home favorite load');
    return;
  }

  try {
    const headers = await getAuthHeaders();
    // API 엔드포인트 변경 (게스트 모드 지원)
    const apiBase = window.isGuest() ? '/api/guest' : '/api/collection';
    const response = await fetch(`${apiBase}/favorites`, { headers });

    if (response.ok) {
      const result = await response.json();
      homeFavorites = result.data || [];
      console.log('Favorites loaded for home:', homeFavorites.length);

      const container = document.getElementById('home-pokemon-container');
      const prevBtn = document.getElementById('home-prev-btn');
      const nextBtn = document.getElementById('home-next-btn');

      if (homeFavorites.length > 0) {
        // 인덱스 초기화 (항상 가장 최근 것부터, 혹은 유지하고 싶다면 로직 추가 가능)
        currentHomeIndex = 0;
        const topFav = homeFavorites[0];
        console.log('Top favorite:', topFav);

        await displayHomePokemon(topFav.pokemon_stable_id, topFav.is_shiny);

        // 네비게이션 버튼 표시 여부 (2개 이상일 때만 표시)
        if (homeFavorites.length > 1) {
          if (prevBtn) {
            prevBtn.style.display = 'flex';
            // 리스너 중복 방지를 위해 새로 복제
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
            newPrevBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigateHomePokemon(-1);
            });
          }
          if (nextBtn) {
            nextBtn.style.display = 'flex';
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
            newNextBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigateHomePokemon(1);
            });
          }
        } else {
          if (prevBtn) prevBtn.style.display = 'none';
          if (nextBtn) nextBtn.style.display = 'none';
        }

      } else {
        // 즐겨찾기가 없으면 숨김
        console.log('No favorites found, hiding home container');
        if (container) container.style.display = 'none';
      }
    } else {
      console.error('Failed to fetch favorites:', response.status);
    }
  } catch (err) {
    console.error('Failed to load home favorite pokemon:', err);
  }
}

// 오늘 획득한 포켓몬 로드 (새벽 4시 ~ 다음 새벽 4시)
async function loadTodayObtainedPokemon() {
  console.log('loadTodayObtainedPokemon called');

  if (!currentUserId && !window.isGuest()) {
    console.log('No current user and not guest, skipping today obtained load');
    return;
  }

  const section = document.getElementById('todayPokemonSection');
  const scrollContainer = document.getElementById('todayPokemonScroll');
  const countBadge = document.getElementById('todayPokemonCount');

  if (!section || !scrollContainer) {
    console.error('Today pokemon section elements not found');
    return;
  }

  try {
    const headers = await getAuthHeaders();
    const apiBase = window.isGuest() ? '/api/guest' : '/api/collection';
    const response = await fetch(`${apiBase}/today`, { headers });

    if (response.ok) {
      const result = await response.json();
      const todayPokemon = result.data || [];
      console.log('Today obtained pokemon loaded:', todayPokemon.length);

      // 전역 변수에 저장 (네비게이션용)
      todayPokemonList = todayPokemon;

      if (todayPokemon.length > 0) {
        section.style.display = 'block';
        countBadge.textContent = todayPokemon.length;

        // 포켓몬 아이콘 카드 렌더링
        scrollContainer.innerHTML = todayPokemon.map(pokemon => `
          <div class="pokemon-card pokemon-icon${pokemon.is_shiny ? ' shiny' : ''}" 
               role="button" 
               tabindex="0"
               aria-label="${pokemon.name} 아이콘"
               onclick="showIconGroupDetail('${pokemon.base_image_name}', '${pokemon.pokemon_stable_id}', ${pokemon.is_shiny}, 'today')"
               onkeypress="if(event.key === 'Enter' || event.key === ' ') showIconGroupDetail('${pokemon.base_image_name}', '${pokemon.pokemon_stable_id}', ${pokemon.is_shiny}, 'today')">
            <div class="pokemon-sprite" data-src="${pokemon.icon_url}"></div>
          </div>
        `).join('');

        // 포켓몬 스프라이트 설정
        scrollContainer.querySelectorAll('.pokemon-sprite').forEach(sprite => {
          setupPokemonSprite(sprite);
        });

      } else {
        // 오늘 획득한 포켓몬이 없으면 섹션 숨김
        section.style.display = 'none';
      }
    } else {
      console.error('Failed to fetch today obtained pokemon:', response.status);
      section.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to load today obtained pokemon:', err);
    section.style.display = 'none';
  }
}

// 디버깅용 전역 노출
window.loadTodayObtainedPokemon = loadTodayObtainedPokemon;

// 디버깅용 전역 노출
window.loadHomeFavoritePokemon = loadHomeFavoritePokemon;

// 페이지 로드 시에도 시도 (이미 로그인 되어 있는 경우 대비)
document.addEventListener('DOMContentLoaded', () => {
  if (window.isAuthenticated && window.isAuthenticated()) {
    loadHomeFavoritePokemon();
    loadTodayObtainedPokemon();
  }
});

// 초기화: 페이지 로드 시 세션 확인 및 auth 상태 변경 처리
function setLoggedInUI(user) {
  authMessage.textContent = user?.email ? `${user.email}로 로그인됨` : "로그인 상태";
  authDiv.style.display = "none";
  contentDiv.style.display = "flex";

  // 홈 화면에 즐겨찾기 포켓몬 로드
  loadHomeFavoritePokemon();

  // 오늘 획득한 포켓몬 로드
  loadTodayObtainedPokemon();

  // 주간 날짜 범위 계산
  updateWeekRanges();

  // 어제 날짜 설정
  setYesterdayDate();

  // 아이콘 컬렉션 자동 로드
  loadUserPokemonIcons();
}

function setLoggedOutUI() {
  authMessage.textContent = "";
  authDiv.style.display = "flex";
  document.body.style.overflow = 'hidden';
  contentDiv.style.display = "none";

  document.getElementById('iconCollectionGrid').innerHTML = "";
}



// Firebase Auth handles authentication state via onAuthStateChanged above
// No need for separate initAuth function

// 모달 닫기
const detailClose = document.getElementById("detail-close");
const detailModal = document.getElementById("detail-modal");
if (detailClose && detailModal) {
  detailClose.addEventListener("click", () => {
    detailModal.style.display = "none";
  });
}

// 진화도 모달 닫기
const evolutionClose = document.getElementById("evolution-close");
const evolutionModal = document.getElementById("evolution-modal");
if (evolutionClose && evolutionModal) {
  evolutionClose.addEventListener("click", () => {
    evolutionModal.style.display = "none";
    document.body.style.overflow = ''; // 배경 스크롤 복원

    // 도감 설명 등 콘텐츠 초기화 (잔상 방지)
    const descEl = document.getElementById('display-description');
    if (descEl) descEl.textContent = '';

    onModalClose();
  });
}

// 즐겨찾기 토글 버튼
const favoriteBtn = document.getElementById("favorite-btn");
if (favoriteBtn) {
  favoriteBtn.addEventListener("click", async () => {
    try {
      // const { data: userData } = await supabaseClient.auth.getUser();
      const userData = { user: currentUserId ? { id: currentUserId } : null };
      if (!userData?.user) {
        showToast('로그인이 필요합니다.');
        return;
      }

      const pokemonStableId = favoriteBtn.dataset.pokemonStableId;
      const isShiny = favoriteBtn.dataset.isShiny === 'true';

      if (!pokemonStableId) {
        showToast('포켓몬 정보를 찾을 수 없습니다.');
        return;
      }

      // 현재 즐겨찾기 상태 확인
      const { data: currentData, error: fetchError } = await supabaseClient
        .from('user_pokemon_collection')
        .select('is_favorite')
        .eq('user_id', userData.user.id)
        .eq('pokemon_stable_id', pokemonStableId)
        .eq('is_shiny', isShiny)
        .single();

      if (fetchError) {
        console.error('즐겨찾기 상태 조회 실패:', fetchError);
        showToast('즐겨찾기 상태를 확인할 수 없습니다.');
        return;
      }

      const newFavoriteState = !currentData.is_favorite;

      // 백엔드 함수 호출
      // TODO: Implement toggle_favorite via local API
      // const { data, error } = await supabaseClient.rpc('toggle_favorite_pokemon', ...);
      console.log('즐겨찾기 토글 기능은 현재 비활성화되어 있습니다.');
      showToast('즐겨찾기 기능은 현재 준비 중입니다.');
    } catch (err) {
      console.error('즐겨찾기 토글 중 예외 발생:', err);
      showToast('즐겨찾기 설정 중 오류가 발생했습니다.');
    }
  });
}
// 스프라이트 정보 저장 객체
// const spriteData = {}; // 이미 위에 선언됨

// PNG 이미지 로드하여 프레임 수 계산 및 애니메이션 설정
function setupSprite(spriteId, imageUrl, animationSpeed = 2) {
  return new Promise((resolve) => {
    const sprite = document.getElementById(spriteId);

    if (!sprite) {
      resolve();
      return;
    }

    // imageUrl이 null이거나 비어있으면 스프라이트를 숨기고 종료
    if (!imageUrl) {
      sprite.style.display = 'none';
      console.log(`✗ ${spriteId}: 이미지 URL이 없습니다.`);
      resolve();
      return;
    }

    // 유효한 URL인 경우 스프라이트 표시
    sprite.style.display = '';

    const img = new Image();
    img.onload = () => {
      const height = img.naturalHeight;
      const width = img.naturalWidth;

      // 프레임 수 계산: 가로 / 세로
      const frames = Math.max(1, Math.round(width / height));  // 최소 1프레임 보장

      // 1프레임 이미지는 애니메이션 없이 정적 표시
      if (frames === 1) {
        sprite.style.width = height + 'px';
        sprite.style.height = height + 'px';
        sprite.style.backgroundSize = `auto ${height}px`;
        sprite.style.backgroundImage = `url("${imageUrl}")`;
        sprite.style.backgroundPosition = '0 0';
        sprite.style.opacity = '1'; // 이미지 로드 완료 후 표시

        console.log(`✓ ${spriteId}: 정적 이미지 (${width}×${height}px)`);
        resolve();
        return;
      }

      // Pokemon Essentials / RPG Maker 방식의 속도 계산 로직 적용
      const ANIMATION_FRAME_DELAY = 90;
      const SPRITE_SPEED = animationSpeed;

      let timePerFrame = ((SPRITE_SPEED / 2) * ANIMATION_FRAME_DELAY) / 1000;

      // 프레임 수에 비례한 duration 계산 (프레임당 일정 시간)
      const duration = frames * timePerFrame;

      // 스프라이트 데이터 저장
      spriteData[spriteId] = {
        frames: frames,
        width: width,
        height: height,
        duration: duration,
        timePerFrame: timePerFrame,
        frameSize: height
      };

      // CSS 동적 생성
      const styleId = `sprite-style-${spriteId}`;
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      const animName = `sprite-anim-dynamic-${spriteId}`;
      styleEl.textContent = `
          @keyframes ${animName} {
            from { background-position: 0 0; }
            to { background-position: -${width}px 0; }
          }
        `;

      // 스프라이트 크기를 이미지 세로 크기에 맞춰 설정
      sprite.style.width = height + 'px';
      sprite.style.height = height + 'px';
      sprite.style.backgroundSize = `auto ${height}px`;
      sprite.style.backgroundImage = `url("${imageUrl}")`;
      sprite.style.animation = `${animName} ${duration}s steps(${frames}) infinite`;

      // Add transition class and trigger reflow
      sprite.classList.add('pokemon-sprite-image');
      requestAnimationFrame(() => {
        sprite.classList.add('loaded');
        sprite.style.opacity = '1'; // 이미지 로드 완료 후 표시
      });

      console.log(`✓ ${spriteId}: ${frames}프레임 애니메이션 설정 완료`);
      resolve();
    };

    img.onerror = () => {
      console.error(`Error loading image for ${spriteId}: ${imageUrl}`);
      // 에러 발생 시에도 resolve하여 진행이 멈추지 않게 함
      resolve();
    };

    img.src = imageUrl;
  });
}

// 포켓몬 스프라이트 설정 함수
function setupPokemonSprite(sprite) {
  const imageUrl = sprite.dataset.src;

  // 초기 상태: 투명하게 설정하여 로딩 중 깜빡임 방지
  sprite.style.opacity = '0';
  sprite.style.transition = 'opacity 0.2s ease';

  const img = new Image();
  img.onload = () => {
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    // 프레임 수 계산: 가로 / 세로
    const frames = Math.round(width / height);

    // 애니메이션 시간 (적정 속도)
    const duration = 1; // 1초에 한 번 반복

    // 랜덤 딜레이 추가 (0~1.5초 사이)
    const randomDelay = Math.random() * duration;

    // CSS 동적 생성
    const animName = `pokemon-sprite-anim-${Math.random().toString(36).substr(2, 9)}`;
    const bounceAnimName = `pokemon-sprite-bounce-${Math.random().toString(36).substr(2, 9)}`;
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        @keyframes ${animName} {
          from { background-position: 0 0; }
          to { background-position: 0 0; }
        }
        @keyframes ${bounceAnimName} {
          0%, 100% { transform: translateY(0px); }
          12.5% { transform: translateY(-0.5px); }
          25% { transform: translateY(-1px); }
          37.5% { transform: translateY(-0.5px); }
          50% { transform: translateY(0px); }
          62.5% { transform: translateY(0.5px); }
          75% { transform: translateY(1px); }
          87.5% { transform: translateY(0.5px); }
        }
      `;
    document.head.appendChild(styleEl);

    // 스프라이트 설정 (컨테이너 크기에 맞춰 스케일 조정)
    const containerHeight = sprite.offsetHeight || 48; // 컨테이너 높이 (기본값)

    // 스타일 적용
    sprite.style.width = containerHeight + 'px';
    sprite.style.height = containerHeight + 'px';
    sprite.style.backgroundSize = `auto ${containerHeight}px`;
    // 중요: img.src를 사용하여 리다이렉트되거나 대체된 실제 이미지 URL을 사용
    sprite.style.backgroundImage = `url("${img.src}")`;
    sprite.style.backgroundPosition = '0 0'; // 명시적으로 첫 프레임 위치 고정
    sprite.style.backgroundRepeat = 'no-repeat';

    // 애니메이션 적용 (미보유 포켓몬은 애니메이션 제외)
    const isNotOwned = sprite.closest('.evolution-pokemon.not-owned');

    if (!isNotOwned) {
      sprite.style.animation = `${animName} ${duration}s steps(${frames}) infinite ${randomDelay}s, ${bounceAnimName} ${duration}s linear infinite ${randomDelay}s`;
    } else {
      sprite.style.animation = 'none';
      // 첫 프레임만 보여줌
      sprite.style.backgroundPosition = '0 0';
    }

    // 로딩 완료 후 표시
    requestAnimationFrame(() => {
      sprite.style.opacity = '1';
    });

    // console.log(`✓ 포켓몬 스프라이트 로드 완료: ${width}×${height}px`);
  };

  img.onerror = () => {
    // console.warn(`포켓몬 스프라이트 이미지 로드 실패: ${imageUrl}, 대체 이미지 시도 중...`);
    // Fallback: data-fallback 속성이 있으면 getPokemonImageUrl로 재시도
    const fallbackImage = sprite.getAttribute('data-fallback-image');
    const fallbackSuffix = sprite.getAttribute('data-fallback-suffix');

    // 이미 대체 이미지를 시도했는데도 실패했다면 중단 (무한루프 방지)
    if (fallbackImage && img.src.includes(fallbackImage) && (!fallbackSuffix || img.src.includes(fallbackSuffix))) {
      // 이미 fallback 시도함.
      sprite.style.opacity = '1'; // 빈 박스라도 표시
      return;
    }

    if (fallbackImage) {
      const fallbackUrl = getPokemonImageUrl(fallbackImage, fallbackSuffix || '', 'icon', false);
      // 재시도: img.src를 변경하면 다시 로드를 시도하고, 성공 시 onload가 호출됨
      img.src = fallbackUrl;
    } else {
      // console.error(`포켓몬 스프라이트 대체 이미지 없음`);
      sprite.style.opacity = '1'; // 실패해도 보이게 함 (빈 박스라도)
    }
  };

  img.src = imageUrl;
}

function changeSpeed(id, multiplier) {
  const sprite = document.getElementById(id);
  const data = spriteData[id];

  if (!data) return;

  const newSpeed = data.duration * multiplier;
  const animName = `sprite-anim-dynamic-${id}`;

  sprite.style.animation = `${animName} ${newSpeed}s steps(${data.frames}) infinite`;
}

// 양쪽 포켓몬 동시 제어 함수
function toggleBothAnimations() {
  toggleAnimation('sprite-back');
  toggleAnimation('sprite-front');
}

function changeBothSpeed(multiplier) {
  changeSpeed('sprite-back', multiplier);
  changeSpeed('sprite-front', multiplier);
}

// 드래그 회전 기능
let isDragging = false;
let startX = 0;
let currentRotation = 0;
let lastTouchTime = 0;
let touchIdentifier = null; // 터치 포인트 추적

// 플리퍼를 정면으로 초기화하는 함수 (부드러운 회전)
function resetFlipperToFront() {
  const flipper = document.getElementById('pokemonFlipper');
  if (!flipper) return;

  // 현재 회전값에서 가장 가까운 정면(360도의 배수) 계산
  // 예: 180 -> 360 (또는 0), -180 -> -360 (또는 0)
  const targetRotation = Math.round(currentRotation / 360) * 360;

  // 변화가 필요할 때만 애니메이션
  if (currentRotation !== targetRotation) {
    currentRotation = targetRotation;
    flipper.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'; // 부드러운 회전
    flipper.style.transform = `translate(-50%, -50%) rotateY(${targetRotation}deg)`;

    setTimeout(() => {
      flipper.style.transition = '';
    }, 600);
  }
}

// 가장 가까운 면으로 스냅하는 함수 (무한 회전 지원)
function snapToNearestFace() {
  const flipper = document.getElementById('pokemonFlipper');
  if (!flipper) return;

  // 현재 회전각에서 가장 가까운 180도 배수로 스냅
  // 0, 180, 360, 540, ... 또는 -180, -360, ...
  const targetRotation = Math.round(currentRotation / 180) * 180;

  currentRotation = targetRotation;
  flipper.style.transition = 'transform 0.4s ease-out';
  flipper.style.transform = `translate(-50%, -50%) rotateY(${targetRotation}deg)`;

  setTimeout(() => {
    flipper.style.transition = '';
  }, 400);
}

// 터치 이벤트 초기화 함수
function initTouchEvents() {
  const flipper = document.getElementById('pokemonFlipper');
  if (!flipper) {
    console.warn('pokemonFlipper element not found');
    return;
  }

  // 마우스 이벤트
  flipper.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    flipper.style.transition = ''; // 드래그 중엔 transition 제거
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const rotationChange = deltaX * 1.5; // 1.5회전 민감도 조절 (더 민감하게)

    currentRotation += rotationChange;
    flipper.style.transform = `translate(-50%, -50%) rotateY(${currentRotation}deg)`;

    startX = e.clientX;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      snapToNearestFace(); // 드래그 종료 시 자동 스냅
    }
  });

  // 터치 이벤트 (모바일 지원) - 개선된 버전
  flipper.addEventListener('touchstart', (e) => {
    // 첫 번째 터치만 추적
    if (e.touches.length === 1) {
      isDragging = true;
      const touch = e.touches[0];
      touchIdentifier = touch.identifier;
      startX = touch.clientX;
      lastTouchTime = Date.now();
      flipper.style.transition = '';

      // 포켓몬 영역에서만 스크롤 방지
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging || touchIdentifier === null) return;

    // 동일한 터치 포인트 찾기
    const touch = Array.from(e.touches).find(t => t.identifier === touchIdentifier);
    if (!touch) return;

    const deltaX = touch.clientX - startX;
    const rotationChange = deltaX * 1.5; // 마우스 이벤트와 동일한 민감도

    currentRotation += rotationChange;
    flipper.style.transform = `translate(-50%, -50%) rotateY(${currentRotation}deg)`;

    startX = touch.clientX;

    // 회전 중에는 스크롤 방지
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (!isDragging) return;

    // 추적 중인 터치가 종료되었는지 확인
    const touchStillActive = Array.from(e.touches).some(t => t.identifier === touchIdentifier);

    if (!touchStillActive) {
      isDragging = false;
      touchIdentifier = null;
      snapToNearestFace(); // 터치 종료 시 자동 스냅
    }
  });

  document.addEventListener('touchcancel', () => {
    if (isDragging) {
      isDragging = false;
      touchIdentifier = null;
      snapToNearestFace();
    }
  });
}

// 페이지 로드 후 터치 이벤트 초기화
window.addEventListener('DOMContentLoaded', () => {
  initTouchEvents();
  setupSettingsListeners();

  // PWA 아이콘 동적 설정 (apple-touch-icon, PWA 배너 이미지 등)
  const appleTouchIcon = document.getElementById('apple-touch-icon');
  const pwaIconImg = document.getElementById('pwa-icon-img');

  if (appleTouchIcon) {
    appleTouchIcon.href = IMAGE_URLS.PWA_ICON_192;
  }

  if (pwaIconImg) {
    pwaIconImg.src = IMAGE_URLS.PWA_ICON_192;
  }

  // 이미지 URL 설정
  const eggSystemIcon = document.getElementById('eggSystemIcon');
  const ovalCharmIcon = document.getElementById('ovalCharmIcon');

  if (eggSystemIcon) {
    eggSystemIcon.src = IMAGE_URLS.EGG_ICON;
  }

  if (ovalCharmIcon) {
    ovalCharmIcon.src = IMAGE_URLS.OVAL_CHARM;
  }

  // 내 포켓몬 아이콘 표시 (기존 테스트 아이콘 로직은 loadUserPokemonIcons 함수로 이동됨)
  // loadUserPokemonIcons(); // Lazy load via tab click

  // Pokedex 탭 클릭 시 아이콘 로드 (Lazy Loading) - initTabNavigation에서 처리됨
  // 중복 리스너 제거됨


  // 새로고침 버튼 로직 (강제 리로드)
  const refreshIconsBtn = document.getElementById('refreshIconsBtn');
  if (refreshIconsBtn) {
    refreshIconsBtn.addEventListener('click', () => {
      window.isPokedexLoaded = false; // 플래그 초기화
      loadUserPokemonIcons();
    });
  }
});

// ==========================================
// 알 시스템 (Egg System) 로직
// ==========================================

const eggModal = document.getElementById('egg-modal');
const eggCloseBtn = document.getElementById('egg-close');
const eggSystemBtn = document.getElementById('eggSystemBtn');
const incubatorSlots = document.getElementById('incubator-slots');
const eggSearchInput = document.getElementById('egg-search-input');
const eggSearchBtn = document.getElementById('egg-search-btn');
const eggSearchResults = document.getElementById('egg-search-results');
const userCharmCount = document.getElementById('user-charm-count');

// API 엔드포인트 (실제 배포 시 수정 필요)
// 로컬 테스트나 Netlify/AWS Lambda 경로에 맞춰 설정하세요.
// API 엔드포인트 (Global API_BASE_URL 사용)

// 모달 열기/닫기
if (eggSystemBtn) {
  eggSystemBtn.addEventListener('click', () => {
    openEggModal();
  });
}

if (eggCloseBtn) {
  eggCloseBtn.addEventListener('click', () => {
    eggModal.style.display = 'none';
    document.body.style.overflow = ''; // 배경 스크롤 복원
    onModalClose();
  });
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
  if (e.target === eggModal) {
    eggModal.style.display = 'none';
    document.body.style.overflow = ''; // 배경 스크롤 복원
    onModalClose();
  }
  if (e.target === evolutionModal) {
    evolutionModal.style.display = 'none';
    document.body.style.overflow = ''; // 배경 스크롤 복원

    const descEl = document.getElementById('display-description');
    if (descEl) descEl.textContent = '';

    onModalClose();
  }
  if (e.target === detailModal) {
    detailModal.style.display = 'none';
  }
});

// Infinite Scroll State
let eggSearchPage = 1;
let eggSearchLoading = false;
let eggSearchHasMore = true;
let eggSearchObserver = null;

async function openEggModal() {
  eggModal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
  onModalOpen();
  await loadUserEggs();

  // Reset infinite scroll state
  eggSearchPage = 1;
  eggSearchHasMore = true;
  eggSearchLoading = false;

  // Clear previous results
  const resultsContainer = document.getElementById('egg-search-results');
  if (resultsContainer) resultsContainer.innerHTML = '';

  await searchEggs(); // 열 때 초기 리스트 로드
}

// 전역 함수로 노출 (HTML onclick에서 사용)
window.openEggModal = openEggModal;

// 부화기 로딩 상태 렌더링 (스켈레톤 UI)
function renderLoadingIncubators() {
  const containers = [
    document.getElementById('incubator-slots'),
    document.getElementById('incubator-slots-modal')
  ];

  containers.forEach(container => {
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
      const slotDiv = document.createElement('div');
      slotDiv.className = 'incubator-slot empty'; // 레이아웃 유지를 위해 클래스 사용

      // 알 이미지 스켈레톤
      const imgSkeleton = document.createElement('div');
      imgSkeleton.className = 'skeleton';
      imgSkeleton.style.width = '60px';
      imgSkeleton.style.height = '60px';
      imgSkeleton.style.borderRadius = '50%';
      imgSkeleton.style.marginBottom = '10px';

      // 텍스트 스켈레톤
      const textSkeleton = document.createElement('div');
      textSkeleton.className = 'skeleton';
      textSkeleton.style.width = '80px';
      textSkeleton.style.height = '14px';
      textSkeleton.style.borderRadius = '4px';

      slotDiv.appendChild(imgSkeleton);
      slotDiv.appendChild(textSkeleton);
      container.appendChild(slotDiv);
    }
  });
}

// 사용자 알 목록 및 부적 개수 로드
async function loadUserEggs() {
  try {
    if (!currentUserId) {
      console.log('비로그인 상태: 알 시스템 데모 데이터 사용 안함');
      renderIncubators([], 0);
      return;
    }

    renderLoadingIncubators(); // 로딩 UI 표시

    // 실제 API 호출
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/eggs`, { headers });
      if (!response.ok) throw new Error('API Error');

      const result = await response.json();
      if (result.success) {
        renderIncubators(result.data.eggs, result.data.round_charms);
      } else {
        throw new Error(result.error || 'Unknown error');
      }

    } catch (apiError) {
      console.error('API 호출 실패:', apiError);
      // 에러 시 빈 상태 표시
      renderIncubators([], 0);
    }

  } catch (err) {
    console.error('Error loading eggs:', err);
  }
}

// 부화기 렌더링
function renderIncubators(eggs, charms) {
  const containers = [
    document.getElementById('incubator-slots'),
    document.getElementById('incubator-slots-modal')
  ];

  const charmCounters = [
    document.getElementById('user-charm-count'),
    document.getElementById('user-charm-count-modal')
  ];

  charmCounters.forEach(el => {
    if (el) el.textContent = charms;
  });

  containers.forEach(container => {
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
      const egg = eggs.find(e => e.slot_index === i);
      const slotDiv = document.createElement('div');
      slotDiv.className = `incubator-slot ${egg ? 'occupied' : 'empty'}`;

      if (egg) {
        // 서버 데이터 기준 부화 여부 판단 (클라이언트 시계 의존성 제거)
        const isHatched = egg.is_hatched || (egg.remaining_seconds !== undefined && egg.remaining_seconds <= 0);

        const eggImg = document.createElement('img');
        eggImg.src = `${ASSETS_BASE_URL}/base/img/Eggs/000.png`;
        eggImg.className = 'egg-img';

        slotDiv.appendChild(eggImg);

        const timerDiv = document.createElement('div');
        timerDiv.className = 'egg-timer';

        if (isHatched) {
          timerDiv.textContent = '부화 가능!';
          timerDiv.style.color = '#2f855a';
          timerDiv.style.background = '#c6f6d5';
          slotDiv.style.cursor = 'pointer';
          slotDiv.style.borderColor = '#48bb78';
          slotDiv.onclick = () => handleHatch(egg);
          eggImg.style.animation = 'bounce 1s infinite';
        } else {
          // 남은 시간 계산 및 실시간 카운트다운
          let currentRemaining = egg.remaining_seconds || 0;

          const updateTimer = () => {
            if (currentRemaining <= 0) {
              timerDiv.textContent = '부화 가능!';
              timerDiv.style.color = '#2f855a';
              timerDiv.style.background = '#c6f6d5';
              slotDiv.style.cursor = 'pointer';
              slotDiv.style.borderColor = '#48bb78';
              slotDiv.onclick = () => handleHatch(egg);
              eggImg.style.animation = 'bounce 1s infinite';

              // 타이머 정지
              if (timerDiv.intervalId) clearInterval(timerDiv.intervalId);
              return;
            }

            const hours = Math.floor(currentRemaining / 3600);
            const mins = Math.floor((currentRemaining % 3600) / 60);
            const secs = Math.floor(currentRemaining % 60);

            if (hours === 0 && mins === 0) {
              timerDiv.textContent = `${secs}초`;
            } else {
              timerDiv.textContent = `${hours}시간 ${mins}분`;
            }

            currentRemaining--;
          };

          updateTimer(); // 즉시 실행

          // 1초마다 갱신
          const intervalId = setInterval(updateTimer, 1000);
          timerDiv.intervalId = intervalId; // 나중에 정리하기 위해 저장 (페이지 이동 시 등)
        }
        slotDiv.appendChild(timerDiv);

        // 포켓몬 이름 (옵션)
        const nameDiv = document.createElement('div');
        nameDiv.style.fontSize = '10px';
        nameDiv.style.marginTop = '4px';
        nameDiv.style.color = '#718096';
        nameDiv.textContent = egg.pokemon_name;
        slotDiv.appendChild(nameDiv);

      } else {
        const emptyImg = document.createElement('img');
        emptyImg.src = `${ASSETS_BASE_URL}/base/img/Eggs/000.png`;
        emptyImg.className = 'egg-img';
        emptyImg.style.filter = 'grayscale(100%)';
        emptyImg.style.opacity = '0.5';
        slotDiv.appendChild(emptyImg);

        const textDiv = document.createElement('div');
        textDiv.className = 'egg-timer';
        textDiv.textContent = '빈 슬롯';
        textDiv.style.background = 'transparent';
        textDiv.style.color = '#a0aec0';
        slotDiv.appendChild(textDiv);
      }

      container.appendChild(slotDiv);
    }
  });
}

// 검색 로직
if (eggSearchBtn) {
  eggSearchBtn.addEventListener('click', () => searchEggs());
}
if (eggSearchInput) {
  eggSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchEggs();
  });
}

async function searchEggs(isAppend = false) {
  const searchInput = document.getElementById('egg-search-input');
  const resultsContainer = document.getElementById('egg-search-results');

  if (!searchInput || !resultsContainer) {
    console.error('Egg search elements not found');
    return;
  }

  const query = searchInput.value.trim();

  // Prevent duplicate loads
  if (eggSearchLoading) return;
  if (isAppend && !eggSearchHasMore) return;

  eggSearchLoading = true;

  // If new search (not append), clear container and show loading
  if (!isAppend) {
    resultsContainer.innerHTML = `<div style="padding:10px; text-align:center;">${query ? '🥚 알을 찾는 중...' : '🥚 목록을 불러오는 중...'}</div>`;
    eggSearchPage = 1; // Reset page on new search
    eggSearchHasMore = true;
  }

  try {
    const headers = await getAuthHeaders();
    // Pass page and limit
    const response = await fetch(`/api/eggs/search?query=${encodeURIComponent(query)}&page=${eggSearchPage}&limit=20`, { headers });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      const newItems = result.data;

      // If we got fewer items than limit, we reached the end
      if (newItems.length < 20) {
        eggSearchHasMore = false;
      } else {
        eggSearchHasMore = true;
      }

      if (newItems.length > 0) {
        eggSearchPage++; // Prepare for next page
      }

      renderEggSearchResults(newItems, resultsContainer, isAppend);
    } else {
      throw new Error(result.error);
    }

  } catch (err) {
    console.error(err);
    if (!isAppend) {
      resultsContainer.innerHTML = '<div style="padding:10px; color:red; text-align:center;">오류가 발생했습니다.</div>';
    }
  } finally {
    eggSearchLoading = false;
  }
}

function renderEggSearchResults(results, container, isAppend) {
  const resultsContainer = container || document.getElementById('egg-search-results');
  if (!resultsContainer) return;

  // If not appending (new search), clear previous content
  if (!isAppend) {
    resultsContainer.innerHTML = '';
  }

  if (results.length === 0 && !isAppend) {
    const searchInput = document.getElementById('egg-search-input');
    const query = searchInput ? searchInput.value.trim() : '';

    if (query) {
      resultsContainer.innerHTML = `
        <div style="padding:10px; text-align:center; color:#718096;">
          <div>검색 결과가 없습니다.</div>
          <small>포켓몬 이름을 정확히 입력해주세요.</small>
          <div style="margin-top: 15px; font-size: 0.85em; color: #a0aec0; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 8px;">
            💡 <strong>전설/환상/울트라비스트/패러독스</strong> 등<br>
            희귀한 포켓몬은 특별한 이벤트를 통해서만 만날 수 있어요!
          </div>
        </div>`;
    } else {
      resultsContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#718096;">획득 가능한 새로운 알이 없습니다.<br><small>이미 모든 종류를 수집하셨나요? 😎</small></div>';
    }
    return;
  }

  // Remove existing sentinel if any
  const existingSentinel = document.getElementById('egg-search-sentinel');
  if (existingSentinel) existingSentinel.remove();

  results.forEach(pokemon => {
    const item = document.createElement('div');
    item.className = 'egg-result-item';

    const isDisabled = pokemon.has_pokemon || pokemon.has_egg;
    const statusText = pokemon.has_pokemon ? '보유중' : (pokemon.has_egg ? '알 보유중' : '');

    item.innerHTML = `
      <div class="pokemon-sprite ${isDisabled ? 'grayscale' : ''}" data-src="${getPokemonImageUrl(pokemon.image_name, '', 'icon')}" data-fallback-image="${pokemon.image_name}" data-fallback-suffix=""></div>
      <div class="egg-result-info">
        <div class="egg-result-name">${pokemon.name}</div>
        <div class="egg-result-time">⏳ ${pokemon.hatch_hours}시간 후 부화</div>
        ${statusText ? `<div class="egg-result-status">${statusText}</div>` : ''}
      </div>
      <button class="acquire-btn ${isDisabled ? 'disabled' : ''}" ${isDisabled ? 'disabled' : ''}>${isDisabled ? '획득불가' : '선택'}</button>
    `;

    const btn = item.querySelector('.acquire-btn');
    if (btn && !isDisabled) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmAcquireEgg(pokemon);
      });
    }

    if (!isDisabled) {
      item.addEventListener('click', () => {
        confirmAcquireEgg(pokemon);
      });
    } else {
      item.style.cursor = 'not-allowed';
      item.style.opacity = '0.6';
    }

    resultsContainer.appendChild(item);
  });

  // 애니메이션 적용
  resultsContainer.querySelectorAll('.pokemon-sprite').forEach(sprite => {
    // 이미 애니메이션이 적용된 경우(appending 시) 제외하고 싶지만, 
    // setupPokemonSprite 내부에서 체크하거나 그냥 다시 호출해도 무방함.
    setupPokemonSprite(sprite);
  });

  // Add sentinel for infinite scroll if there are more items
  if (eggSearchHasMore) {
    const sentinel = document.createElement('div');
    sentinel.id = 'egg-search-sentinel';
    sentinel.style.height = '20px';
    sentinel.style.width = '100%';
    resultsContainer.appendChild(sentinel);

    setupInfiniteScrollObserver(sentinel);
  }
}

function setupInfiniteScrollObserver(sentinel) {
  if (eggSearchObserver) {
    eggSearchObserver.disconnect();
  }

  eggSearchObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && eggSearchHasMore && !eggSearchLoading) {
      // 검색어가 있으면 검색어 유지, 없으면 빈 문자열 (searchEggs 내부에서 input value 참조함)
      searchEggs(true);
    }
  }, { threshold: 0.5 });

  eggSearchObserver.observe(sentinel);
}

// 커스텀 확인 모달 로직
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

let currentConfirmResolve = null;

// showConfirmModal 중복 정의 제거됨 (아래 통합 버전 사용)

async function confirmAcquireEgg(pokemon) {
  console.log('confirmAcquireEgg 함수 호출됨:', pokemon);

  // 현재 보유량 가져오기
  const charmCount = parseInt(userCharmCount.textContent || '0');
  const cost = 1;

  // 포켓몬 아이콘 URL
  const iconUrl = getPokemonImageUrl(pokemon.stable_id, '', 'icon', false);

  const confirmed = await showConfirmModal(
    '알 획득',
    `<div style="text-align: center;">    
      <strong style="font-size: 18px;">${pokemon.name}</strong> 알을 가져오시겠습니까?<br><br>
      <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0;">
        <img src="${IMAGE_URLS.OVAL_CHARM}" width="32" height="32">
        <span>소모: 둥근부적 <strong>${cost}개</strong></span>
      </div>
      <small style="color:#666">(보유: ${charmCount}개)</small>
    </div>`
  );

  console.log('모달 결과:', confirmed);

  if (confirmed) {
    console.log('acquireEgg 호출 시작');
    await acquireEgg(pokemon);
  }
}

async function acquireEgg(pokemon) {
  // 게스트 모드 체크
  if (window.isGuest()) {
    showToast('체험 모드에서는 알을 획득할 수 없습니다.');
    return;
  }

  // 둥근부적 확인 (UI 상태 기반)
  const currentCharms = parseInt(userCharmCount.textContent || '0');

  if (currentCharms < 1) {
    showToast('❌ 둥근부적이 부족합니다!');
    return;
  }

  // 슬롯 확인
  const occupied = document.querySelectorAll('.incubator-slot.occupied').length;
  if (occupied >= 3) {
    showToast('❌ 알 슬롯이 가득 찼습니다!');
    return;
  }

  // API 호출
  try {
    if (!currentUserId) {
      showToast('로그인이 필요합니다.');
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/eggs/acquire`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        pokemonStableId: pokemon.stable_id
      })
    });

    const result = await response.json();

    if (result.success) {
      // 성공 시 UI 업데이트
      userCharmCount.textContent = result.data.remaining_charms;
      showToast(result.data.message);

      // 검색 결과 및 입력 초기화
      if (eggSearchInput) eggSearchInput.value = '';
      if (eggSearchResults) eggSearchResults.innerHTML = '';

      // 알 목록 새로고침
      await loadUserEggs();
    } else {
      throw new Error(result.error || '알 획득 실패');
    }

  } catch (err) {
    console.error("Egg acquire error:", err);
    showToast(err.message || '오류가 발생했습니다.');
  }
}

function showToast(message, duration = 2500) {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '30px',
    zIndex: '10000',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transition: 'opacity 0.3s',
    whiteSpace: 'nowrap',
    minWidth: '300px',
    textAlign: 'center'
  });

  document.body.appendChild(toast);

  // 애니메이션
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
// 전역 노출 (pwa.js 등 다른 스크립트에서 사용 가능하도록)
window.showToast = showToast;



async function handleHatch(egg) {
  console.log('handleHatch 호출됨:', egg);

  // 사용자 ID 재확인 및 동기화 시도
  if (!currentUserId) {
    const user = firebase.auth().currentUser;
    if (user) {
      console.log('currentUserId 없음. Firebase 유저로 동기화 시도:', user.uid);
      showToast('⏳ 사용자 정보를 동기화 중입니다...');

      try {
        // 동기화 요청 직접 수행
        const idToken = await user.getIdToken();
        const syncResponse = await fetch(`${API_BASE_URL}/auth/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            idToken: idToken,
            email: user.email,
            username: user.displayName
          })
        });

        const syncData = await syncResponse.json();
        if (syncData && syncData.success) {
          currentUserId = syncData.data;
          console.log('동기화 성공, currentUserId:', currentUserId);
        } else {
          throw new Error('동기화 실패');
        }
      } catch (e) {
        console.error('동기화 중 오류:', e);
        showToast('❌ 사용자 정보 동기화에 실패했습니다. 새로고침 해주세요.');
        return;
      }
    } else {
      showToast('❌ 로그인이 필요합니다.');
      return;
    }
  }

  // 한 번 더 확인
  if (!currentUserId) {
    showToast('❌ 사용자 정보를 불러올 수 없습니다.');
    return;
  }

  const confirmed = await showConfirmModal(
    '알 부화',
    `<strong>${egg.pokemon_name}</strong> 알을 부화시키겠습니까?`
  );

  if (!confirmed) return;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/eggs/hatch', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        // userId extracted from token
        eggId: egg.egg_id
      })
    });

    const result = await response.json();

    if (result.success) {
      // 성공 메시지 표시
      showToast(result.data.message);

      // 알 목록 새로고침
      await loadUserEggs();

      // 컬렉션도 새로고침 (새 포켓몬인 경우)
      if (result.data.is_new) {
        // 내 포켓몬 아이콘 새로고침
        if (typeof loadUserPokemonIcons === 'function') {
          loadUserPokemonIcons();
        }
      }

      // 도감 탭으로 자동 이동 (새 포켓몬 확인)
      const pokedexTabItem = document.querySelector('.tab-item[data-tab="pokedex"]');
      if (pokedexTabItem) {
        pokedexTabItem.click();
      }
    } else {
      throw new Error(result.error || '부화 실패');
    }

  } catch (err) {
    console.error('Hatch error:', err);
    showToast(`❌ ${err.message || '부화 중 오류가 발생했습니다.'}`);
  }
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
`;
document.head.appendChild(style);

// ==========================================
// 설정 패널 (Settings Panel) 로직
// ==========================================

// 설정 화면 열기
function openSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) {
    panel.classList.remove('slide-hidden');
    panel.classList.add('slide-visible');
    // 뒤 화면 스크롤 방지
    document.body.style.overflow = 'hidden';
  }
}

// 설정 화면 닫기
function closeSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) {
    panel.classList.remove('slide-visible');
    panel.classList.add('slide-hidden');
    // 뒤 화면 스크롤 복원
    document.body.style.overflow = '';
  }
}

// 설정 리스너 초기화
function setupSettingsListeners() {
  const cryToggle = document.getElementById('cry-sound-toggle');
  if (cryToggle) {
    // 초기 상태 반영
    if (isCrySoundEnabled) {
      cryToggle.classList.add('active');
    } else {
      cryToggle.classList.remove('active');
    }

    cryToggle.addEventListener('click', () => {
      isCrySoundEnabled = !isCrySoundEnabled;
      localStorage.setItem('crySoundEnabled', isCrySoundEnabled);

      if (isCrySoundEnabled) {
        cryToggle.classList.add('active');
      } else {
        cryToggle.classList.remove('active');
      }
    });
  }
}

// 전역으로 함수 노출 (HTML onclick 속성에서 사용하기 위함)
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.showIconGroupDetail = showIconGroupDetail;

// ==========================================
// Info Modal 로직
// ==========================================

// 프로젝트 정보 모달 열기
function openInfoModal() {
  const modal = document.getElementById('info-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    onModalOpen();
    // 기본 탭으로 초기화
    switchInfoTab('overview');
  }
}

// 프로젝트 정보 모달 닫기
function closeInfoModal() {
  const modal = document.getElementById('info-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
  }
}

// 탭 전환 함수
function switchInfoTab(tabId) {
  // 모든 탭 버튼 비활성화
  document.querySelectorAll('.info-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  // 모든 탭 콘텐츠 숨기기
  document.querySelectorAll('.info-tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // 선택된 탭 활성화
  const selectedTab = document.querySelector(`.info-tab[data-tab="${tabId}"]`);
  const selectedContent = document.getElementById(`tab-${tabId}`);

  if (selectedTab) selectedTab.classList.add('active');
  if (selectedContent) selectedContent.classList.add('active');
}

// 아코디언 토글 함수
function toggleAccordion(accordionItem) {
  const isOpen = accordionItem.classList.contains('open');

  // 같은 그룹 내 다른 아코디언 닫기 (선택적)
  // const group = accordionItem.closest('.accordion-group');
  // group.querySelectorAll('.accordion-item.open').forEach(item => {
  //   if (item !== accordionItem) item.classList.remove('open');
  // });

  // 토글
  if (isOpen) {
    accordionItem.classList.remove('open');
  } else {
    accordionItem.classList.add('open');
  }
}

// Info Modal 이벤트 리스너 초기화
function initInfoModalListeners() {
  // 탭 클릭 이벤트
  document.querySelectorAll('.info-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      switchInfoTab(tabId);
    });
  });

  // 아코디언 헤더 클릭 이벤트 (이벤트 위임 사용 - Debugging Added)
  document.addEventListener('click', (e) => {
    // console.log('Click detected on:', e.target);
    const header = e.target.closest('.accordion-header');
    if (header) {
      console.log('Accordion Header Clicked!');
      const accordionItem = header.closest('.accordion-item');
      if (accordionItem) {
        console.log('Toggling item:', accordionItem.dataset.tier);
        try {
          toggleAccordion(accordionItem);
        } catch (err) {
          console.error('Toggle failed:', err);
        }
      }
    }
  });
}

// 전역으로 함수 노출
window.openInfoModal = openInfoModal;
window.closeInfoModal = closeInfoModal;

// info-modal 닫기 버튼 이벤트 리스너
const infoCloseBtn = document.getElementById('info-close');
if (infoCloseBtn) {
  infoCloseBtn.addEventListener('click', closeInfoModal);
}

// info-modal 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
  const infoModal = document.getElementById('info-modal');
  if (e.target === infoModal) {
    closeInfoModal();
  }
});

// DOM 로드 시 이벤트 리스너 초기화
document.addEventListener('DOMContentLoaded', initInfoModalListeners);




// --- Evolution & Form Unlock Logic ---

// 확인 모달 표시 함수
// 확인 모달 표시 함수 (Promise & Callback 지원)
function showConfirmModal(title, message, onOpen = null) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
      // Fallback
      const result = confirm(message.replace(/<[^>]*>/g, ''));
      resolve(result);
      return;
    }

    titleEl.textContent = title;
    msgEl.innerHTML = message; // HTML 허용

    // 기존 리스너 제거를 위해 복제
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      onModalClose();
      resolve(true);
    });

    newCancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      onModalClose();
      resolve(false);
    });

    modal.style.display = 'flex';
    onModalOpen();

    // 모달이 열린 후 onOpen 콜백 실행
    if (onOpen) onOpen();
  });
}

// 사용자 아이템 조회
async function fetchUserItems() {
  if (!currentUserId) return {};
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/user/items', { headers });
    if (!response.ok) return {};
    const result = await response.json();
    return result.data || {};
  } catch (e) {
    console.error("Failed to fetch items:", e);
    return {};
  }
}

// 실제 진화 API 호출
async function executeEvolution(currentId, targetId, cost, baseImageName) {
  try {
    showGlobalLoading('진화 중...'); // 로딩 시작
    const headers = await getAuthHeaders();
    const response = await fetch('/api/pokemon/evolve', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        // userId extracted from token
        currentPokemonId: currentId,
        targetPokemonId: targetId,
        cost
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `얼라리...? ${targetId}의 진화가 실패했다!`);
    }

    // 성공 시
    showToast(`${result.data.message}`);

    // 데이터 갱신
    await showIconGroupDetail(baseImageName, targetId);
    // 아이콘 목록도 갱신
    loadUserPokemonIcons();
    // 오늘의 포켓몬 및 수면 상태 갱신
    if (typeof loadTodayObtainedPokemon === 'function') loadTodayObtainedPokemon();
    if (window.sleepTracker && typeof window.sleepTracker.loadSleepStatus === 'function') {
      await window.sleepTracker.loadSleepStatus();
    }

  } catch (e) {
    showToast(e.message);
  } finally {
    hideGlobalLoading(); // 로딩 종료
  }
}

// 포켓몬 진화 처리 (UI 호출용)
async function handleEvolutionClick(currentStableId, targetStableId, targetName, cost, baseImageName) {
  let candyCount = 0;

  try {
    showGlobalLoading('정보 확인 중...');
    const items = await fetchUserItems();
    candyCount = items['Rare Candy']?.quantity || 0;
  } catch (e) {
    console.error('Failed to fetch items:', e);
  } finally {
    hideGlobalLoading();
  }

  if (candyCount < cost) {
    showToast(`이상한 사탕이 부족합니다..!\n보유: ${candyCount}개 / 필요: ${cost}개`);
    return;
  }

  const confirmed = await showConfirmModal(
    '진화',
    `<strong>${targetName}</strong>(으)로 진화하시겠습니까?<br><br>
     <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0;">
       <img src="${IMAGE_URLS.RARE_CANDY}" width="32" height="32">
       <span>소모: 이상한 사탕 <strong>${cost}개</strong></span>
     </div>
     <small style="color:#666">(보유: ${candyCount}개)</small>`
  );

  if (confirmed) {
    await executeEvolution(currentStableId, targetStableId, cost, baseImageName);
  }
}

// 폼 해제 처리 (UI 호출용)
async function handleFormUnlockClick(targetStableId, targetName, baseImageName, isRarePokemon = false) {
  const itemName = isRarePokemon ? 'Awakening Charm' : 'Mystic Charm';
  const itemNameKo = isRarePokemon ? '각성의 부적' : '신비의 부적';
  const itemImage = isRarePokemon ? IMAGE_URLS.AWAKENING_CHARM : IMAGE_URLS.MYSTIC_CHARM;
  const cost = 1;
  let charmCount = 0;

  try {
    showGlobalLoading('정보 확인 중...');
    const items = await fetchUserItems();
    charmCount = items[itemName]?.quantity || 0;
  } catch (e) {
    console.error('Failed to fetch items:', e);
  } finally {
    hideGlobalLoading();
  }

  if (charmCount < cost) {
    showToast(`${itemNameKo}이 부족합니다...!`);
    return;
  }

  const confirmed = await showConfirmModal(
    '폼 해제',
    `<strong>${targetName}</strong> 폼을 해제하시겠습니까?<br><br>
     <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0;">
       <img src="${itemImage}" width="32" height="32">
       <span>소모: ${itemNameKo} <strong>${cost}개</strong></span>
     </div>
     <small style="color:#666">(보유: ${charmCount}개)</small>`
  );

  if (confirmed) {
    try {
      showGlobalLoading('폼 해제 중...'); // 로딩 시작
      const headers = await getAuthHeaders();
      const response = await fetch('/api/pokemon/unlock-form', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          // userId extracted from token
          targetFormId: targetStableId,
          baseImageName
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `얼라리...? ${targetName}의 폼 해제가 실패했다!`);
      }

      showToast(`${result.data.message}`);
      await showIconGroupDetail(baseImageName, targetStableId);
      loadUserPokemonIcons();
      // 오늘의 포켓몬 및 수면 상태 갱신
      if (typeof loadTodayObtainedPokemon === 'function') loadTodayObtainedPokemon();
      if (window.sleepTracker && typeof window.sleepTracker.loadSleepStatus === 'function') {
        await window.sleepTracker.loadSleepStatus();
      }

    } catch (e) {
      showToast(e.message);
    } finally {
      hideGlobalLoading(); // 로딩 종료
    }
  }
}

// ============================================
// 약관 동의 및 스타터 포켓몬 시스템
// ============================================

// 약관 세부사항 토글
window.toggleTermsDetail = function (detailId) {
  const el = document.getElementById(detailId);
  if (el) {
    el.classList.toggle('show');
  }
};

// 전체 약관 동의/해제
window.toggleAllTerms = function () {
  const checkAll = document.getElementById('terms-check-all');
  const checkboxes = document.querySelectorAll('.terms-req-check');

  checkboxes.forEach(cb => {
    cb.checked = checkAll.checked;
  });

  checkTermsStatus();
};

// 약관 상태 확인 (버튼 활성화)
window.checkTermsStatus = function () {
  const checkboxes = document.querySelectorAll('.terms-req-check');
  const checkAll = document.getElementById('terms-check-all');
  const submitBtn = document.getElementById('terms-submit-btn');

  let allChecked = true;
  checkboxes.forEach(cb => {
    if (!cb.checked) allChecked = false;
  });

  // 전체 동의 체크박스 UI 동기화
  if (checkAll) {
    checkAll.checked = allChecked;
  }

  // 버튼 활성화/비활성화
  if (submitBtn) {
    if (allChecked) {
      submitBtn.disabled = false;
      submitBtn.style.background = 'linear-gradient(135deg, #CD5C5C 0%, #B04040 100%)';
      submitBtn.style.color = 'white';
      submitBtn.style.cursor = 'pointer';
      submitBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    } else {
      submitBtn.disabled = true;
      submitBtn.style.background = '#d1d5db';
      submitBtn.style.color = '#9ca3af';
      submitBtn.style.cursor = 'not-allowed';
      submitBtn.style.boxShadow = 'none';
    }
  }
};

// 약관 동의 거부 처리
async function handleTermsRefusal() {
  if (confirm('약관에 동의하지 않으면 서비스를 이용할 수 없습니다.\n정말 거부하시겠습니까?')) {
    try {
      // 로그아웃 처리
      if (window.firebaseAuth && window.firebaseSignOut) {
        await window.firebaseSignOut(window.firebaseAuth);
      }

      // 약관 모달 숨기기
      document.getElementById('terms-modal').style.display = 'none';
      onModalClose();

      // 로그인 화면 표시
      authDiv.style.display = "flex";
      contentDiv.style.display = "none";

      showToast('약관 동의가 거부되어 초기 화면으로 돌아갑니다.');
    } catch (error) {
      console.error('Refusal error:', error);
      showToast('오류가 발생했습니다.');
    }
  }
}

// 초기 스크린타임 코드 입력 헬퍼 함수들
function getInitialScreenTimeCodeValue() {
  const digits = [];
  for (let i = 1; i <= 4; i++) {
    const digit = document.getElementById(`initialScreenTimeDigit${i}`);
    if (digit && digit.value) {
      digits.push(digit.value);
    }
  }
  return digits.length > 0 ? parseInt(digits.join('')) : NaN;
}

function clearInitialScreenTimeCodeInputs() {
  for (let i = 1; i <= 4; i++) {
    const digit = document.getElementById(`initialScreenTimeDigit${i}`);
    if (digit) {
      digit.value = '';
    }
  }
  const checkbox = document.getElementById('initialIsOver10Hours');
  if (checkbox) checkbox.checked = false;
  updateInitialTimePreview();
}

// 초기 스크린타임 입력 모달 표시
async function completeTermsAgreement() {
  try {
    // 약관 모달 숨기기
    document.getElementById('terms-modal').style.display = 'none';
    // terms 모달은 닫지만 initial-screentime 모달이 바로 열리므로 onModalClose 호출 안함

    // 초기 스크린타임 입력 모달 표시
    showInitialScreenTimeModal();

  } catch (error) {
    console.error('Terms agreement error:', error);
    showToast('약관 동의 처리 중 오류가 발생했습니다: ' + error.message);
  }
}

// 초기 스크린타임 입력 모달 표시
function showInitialScreenTimeModal() {
  const modal = document.getElementById('initial-screentime-modal');
  if (modal) {
    modal.style.display = 'flex';
    // onModalOpen 호출 안함: terms-modal에서 연속으로 열리므로 이미 열린 상태
    // 입력 필드 초기화
    clearInitialScreenTimeCodeInputs();
  }
}

// 초기 스크린타임 저장 및 완료 (입력 시)
async function submitInitialScreenTime() {
  const code = getInitialScreenTimeCodeValue();
  if (isNaN(code)) {
    showToast('스크린타임을 입력해주세요.');
    return;
  }

  const codeStr = code.toString();
  let hours, minutes;
  const isOver10HoursChecked = document.getElementById('initialIsOver10Hours')?.checked || false;

  if (codeStr.length === 4) {
    hours = parseInt(codeStr.substring(0, 2));
    minutes = parseInt(codeStr.substring(2, 4));
  } else if (codeStr.length === 3) {
    if (isOver10HoursChecked) {
      hours = parseInt(codeStr.substring(0, 2));
      minutes = parseInt(codeStr.substring(2, 3));
    } else {
      hours = parseInt(codeStr.substring(0, 1));
      minutes = parseInt(codeStr.substring(1, 3));
    }
  } else if (codeStr.length === 2 || codeStr.length === 1) {
    hours = 0;
    minutes = code;
  } else {
    showToast('올바른 스크린타임을 입력해주세요.');
    return;
  }

  if (minutes >= 60 || hours >= 24) {
    showToast('올바른 시간을 입력해주세요. (분은 59 이하, 시간은 23 이하)');
    return;
  }

  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes <= 0) {
    showToast('올바른 스크린타임을 입력해주세요.');
    return;
  }

  try {
    // 약관 동의 + 초기 스크린타임 함께 저장
    const headers = await getAuthHeaders();
    const response = await fetch('/api/user/terms-agreement', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        agreed: true,
        initialScreenTimeMinutes: totalMinutes
      })
    });

    if (!response.ok) {
      throw new Error('저장 실패');
    }

    // 초기 스크린타임 모달 숨기기
    document.getElementById('initial-screentime-modal').style.display = 'none';
    // initial-screentime 모달은 닫지만 starter-welcome 모달이 바로 열리므로 onModalClose 호출 안함

    // 스타터 포켓몬 환영 모달 표시
    await showStarterWelcomeModal();

  } catch (error) {
    console.error('Initial screen time save error:', error);
    showToast('저장 중 오류가 발생했습니다: ' + error.message);
  }
}

// 초기 스크린타임 입력 시간 미리보기 업데이트
function updateInitialTimePreview() {
  const preview = document.getElementById('initialTimePreview');
  const submitBtn = document.getElementById('initial-screentime-submit-btn');
  if (!preview || !submitBtn) return;

  const code = getInitialScreenTimeCodeValue();
  if (isNaN(code)) {
    preview.textContent = '-';
    submitBtn.disabled = true;
    return;
  }

  const codeStr = code.toString();
  let hours, minutes;
  const isOver10HoursChecked = document.getElementById('initialIsOver10Hours')?.checked || false;

  if (codeStr.length === 4) {
    hours = parseInt(codeStr.substring(0, 2));
    minutes = parseInt(codeStr.substring(2, 4));
  } else if (codeStr.length === 3) {
    if (isOver10HoursChecked) {
      hours = parseInt(codeStr.substring(0, 2));
      minutes = parseInt(codeStr.substring(2, 3));
    } else {
      hours = parseInt(codeStr.substring(0, 1));
      minutes = parseInt(codeStr.substring(1, 3));
    }
  } else if (codeStr.length === 2 || codeStr.length === 1) {
    hours = 0;
    minutes = code;
  } else {
    preview.textContent = '-';
    submitBtn.disabled = true;
    return;
  }

  if (minutes >= 60) {
    preview.textContent = '⚠️ 분은 59 이하여야 합니다';
    preview.style.color = '#EF4444';
    submitBtn.disabled = true;
  } else if (hours >= 24) {
    preview.textContent = '⚠️ 24시간을 넘을 수 없습니다';
    preview.style.color = '#EF4444';
    submitBtn.disabled = true;
  } else {
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes > 0) {
      preview.textContent = `📱 ${hours}시간 ${minutes}분`;
      preview.style.color = '#CD5C5C';
      submitBtn.disabled = false;
    } else {
      preview.textContent = '-';
      submitBtn.disabled = true;
    }
  }
}

function setupInitialScreenTimeCodeInputs() {
  const digitInputs = [];
  for (let i = 1; i <= 4; i++) {
    const input = document.getElementById(`initialScreenTimeDigit${i}`);
    if (input) {
      digitInputs.push(input);
    }
  }

  digitInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      if (!/^\d*$/.test(value)) {
        e.target.value = value.replace(/\D/g, '');
        return;
      }
      if (value && index < digitInputs.length - 1) {
        digitInputs[index + 1].focus();
      }
      updateInitialTimePreview();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (!e.target.value && index > 0) {
          digitInputs[index - 1].focus();
          digitInputs[index - 1].value = '';
        }
        setTimeout(() => updateInitialTimePreview(), 0);
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        digitInputs[index - 1].focus();
      }
      if (e.key === 'ArrowRight' && index < digitInputs.length - 1) {
        e.preventDefault();
        digitInputs[index + 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
      for (let i = 0; i < pastedData.length && (index + i) < digitInputs.length; i++) {
        digitInputs[index + i].value = pastedData[i];
      }
      const nextIndex = Math.min(index + pastedData.length, digitInputs.length - 1);
      digitInputs[nextIndex].focus();
      updateInitialTimePreview();
    });

    input.addEventListener('focus', () => {
      input.select();
    });
  });

  const isOver10HoursCheckbox = document.getElementById('initialIsOver10Hours');
  if (isOver10HoursCheckbox) {
    isOver10HoursCheckbox.addEventListener('change', updateInitialTimePreview);
  }
}

// 스타터 포켓몬 환영 모달 표시
async function showStarterWelcomeModal() {
  const modal = document.getElementById('starter-welcome-modal');

  // 데이터 로드 (아직 로드되지 않았거나 실패한 경우 재시도)
  await loadStarterPokemon();

  // 모달 표시
  modal.style.display = 'flex';
}

// 스타터 포켓몬 모달 닫기 및 메인 화면 표시
function closeStarterWelcomeModal() {
  document.getElementById('starter-welcome-modal').style.display = 'none';
  onModalClose(); // 마지막 온보딩 모달이 닫힐 때 theme-color 복원

  // 메인 콘텐츠 표시 및 초기 데이터 로드
  contentDiv.style.display = 'flex';
  loadUserPokemonIcons();
}

// 이벤트 리스너 설정
if (document.getElementById('terms-submit-btn')) {
  document.getElementById('terms-submit-btn').addEventListener('click', completeTermsAgreement);
}

if (document.getElementById('terms-refuse-btn')) {
  document.getElementById('terms-refuse-btn').addEventListener('click', handleTermsRefusal);
}

if (document.getElementById('starter-modal-close-btn')) {
  document.getElementById('starter-modal-close-btn').addEventListener('click', closeStarterWelcomeModal);
}

// 초기 스크린타임 입력 모달 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
  // 4자리 코드 입력 설정
  setupInitialScreenTimeCodeInputs();

  // 제출 버튼
  const submitBtn = document.getElementById('initial-screentime-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitInitialScreenTime);
  }
});

// 약관 체크박스에 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', () => {
  const termsCheckAll = document.getElementById('terms-check-all');
  if (termsCheckAll) {
    termsCheckAll.addEventListener('change', function () {
      const checkboxes = document.querySelectorAll('.terms-req-check');
      checkboxes.forEach(cb => {
        cb.checked = this.checked;
      });
      checkTermsStatus();
    });
  }

  // 전체 동의 박스 클릭 처리 (체크박스/라벨 외 영역 클릭 시)
  const termsBox = document.querySelector('.terms-all-agree-box');
  if (termsBox) {
    termsBox.addEventListener('click', (e) => {
      // 체크박스나 라벨을 클릭한 경우는 브라우저가 알아서 처리하므로 무시
      if (e.target.type === 'checkbox' || e.target.closest('label')) return;

      const checkAll = document.getElementById('terms-check-all');
      if (checkAll) {
        checkAll.click(); // 체크박스 클릭 트리거 (onchange 이벤트 발생)
      }
    });
  }
});

// 스타터 포켓몬 로드 함수 (스타터 모달이 열릴 때 API에서 로드)
let starterPokemonLoaded = false;

async function loadStarterPokemon() {
  const starterGrid = document.getElementById('starter-pokemon-grid');
  if (!starterGrid) return;

  // 이미 로드되었으면 중복 로드 방지
  if (starterPokemonLoaded) return;

  // 로딩 표시
  starterGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666;">포켓몬을 불러오는 중...</div>';

  try {
    // Guest API에서 스타터 포켓몬 데이터 로드
    const response = await fetch('/api/guest/starter-pokemon');
    if (!response.ok) throw new Error('Failed to fetch starter pokemon');

    const result = await response.json();
    const starterData = result.data || result;

    starterGrid.innerHTML = ''; // 초기화

    // 세대 순으로 정렬
    const sortedData = [...starterData].sort((a, b) => {
      if (a.generation !== b.generation) return a.generation - b.generation;
      return 0;
    });

    sortedData.forEach(pokemon => {
      const typeClass = getTypeClass(pokemon.type1);

      const itemDiv = document.createElement('div');
      itemDiv.className = 'starter-pokemon-item';
      itemDiv.innerHTML = `
        <div class="starter-pokemon-visual ${typeClass}">
          <div class="starter-pokemon-image">
            <div class="sprite" data-src="${pokemon.front_image}"></div>
          </div>
        </div>
        <div class="starter-pokemon-info">
          <div class="starter-pokemon-name">${pokemon.name}</div>     
        </div>
      `;

      starterGrid.appendChild(itemDiv);

      // 스프라이트 애니메이션 설정
      const spriteDiv = itemDiv.querySelector('.sprite');
      if (spriteDiv) {
        setupPokemonSprite(spriteDiv);
      }
    });

    starterPokemonLoaded = true;
  } catch (error) {
    console.error('Failed to load starter pokemon:', error);
    starterGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">포켓몬을 불러올 수 없습니다.</p>';
  }
}

// 스타터 모달이 열릴 때 로드 (DOMContentLoaded 대신)
document.addEventListener('DOMContentLoaded', () => {
  const starterModal = document.getElementById('starter-modal');
  if (starterModal) {
    // MutationObserver로 모달이 보여질 때 감지
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const display = starterModal.style.display;
          if (display === 'flex' || display === 'block') {
            loadStarterPokemon();
          }
        }
      });
    });
    observer.observe(starterModal, { attributes: true });
  }
});
// ==========================================
// 포켓몬 필터 시스템
// ==========================================

// 필터 상태 (localStorage에 저장)
const FILTER_STORAGE_KEY = 'pokemonCollectionFilter';
let currentFilter = {
  favoritesOnly: false,
  legendaryOnly: false, // 전설만 보기
  mythicalOnly: false, // 환상만 보기
  completion: 'all', // 'all', 'complete', 'incomplete'
  types: [], // 복수 타입 선택 가능 ([] = 전체)
  habitats: [], // 복수 서식지 선택 가능 ([] = 전체)
  generations: [], // 복수 세대 선택 가능 ([] = 전체)
  sort: 'default', // 'default', 'progress-high', 'progress-low', 'generation'
  searchQuery: '' // 검색어
};

// 필터 설정 불러오기
function loadFilterSettings() {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      currentFilter = { ...currentFilter, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('필터 설정 로드 실패:', e);
  }
  return currentFilter;
}

// 필터 설정 저장
function saveFilterSettings() {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(currentFilter));
  } catch (e) {
    console.warn('필터 설정 저장 실패:', e);
  }
}

// 필터 모달 초기화
function initPokemonFilter() {
  loadFilterSettings();

  const filterBtn = document.getElementById('filterIconsBtn');
  const filterModal = document.getElementById('pokemon-filter-modal');
  const filterClose = document.getElementById('filter-modal-close');
  const filterApply = document.getElementById('filter-apply-btn');
  const filterReset = document.getElementById('filter-reset-btn');
  const favoritesToggle = document.getElementById('filter-favorites-toggle');
  const legendaryToggle = document.getElementById('filter-legendary-toggle');
  const mythicalToggle = document.getElementById('filter-mythical-toggle');

  if (!filterBtn || !filterModal) return;

  // 필터 버튼 클릭 - 모달 열기
  filterBtn.addEventListener('click', () => {
    openFilterModal();
  });

  // 모달 닫기 함수 (필터 자동 적용)
  const closeFilterModal = () => {
    applyFilter(); // 필터를 자동으로 적용
    filterModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
  };

  // 모달 닫기 버튼
  if (filterClose) {
    filterClose.addEventListener('click', closeFilterModal);
  }

  // 모달 외부 클릭 시 닫기 (필터 자동 적용)
  filterModal.addEventListener('click', (e) => {
    if (e.target === filterModal) {
      closeFilterModal();
    }
  });

  // 즐겨찾기 토글
  if (favoritesToggle) {
    favoritesToggle.addEventListener('click', () => {
      favoritesToggle.classList.toggle('active');
    });
  }

  // 전설 토글
  if (legendaryToggle) {
    legendaryToggle.addEventListener('click', () => {
      legendaryToggle.classList.toggle('active');
    });
  }

  // 환상 토글
  if (mythicalToggle) {
    mythicalToggle.addEventListener('click', () => {
      mythicalToggle.classList.toggle('active');
    });
  }

  // 필터 칩 클릭 이벤트
  filterModal.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const filterType = chip.dataset.filter;
      // data-filter가 없는 경우(토글 버튼 등)는 공통 로직 무시
      if (!filterType) return;

      const value = chip.dataset.value;

      if (filterType === 'type') {
        // 타입은 최대 2개까지 선택 가능
        if (value === 'all') {
          // '전체' 선택 시 다른 타입 모두 해제
          filterModal.querySelectorAll('.filter-chip[data-filter="type"]').forEach(c => {
            c.classList.remove('active');
          });
          chip.classList.add('active');
        } else {
          // 특정 타입 선택 시 '전체' 해제
          filterModal.querySelector('.filter-chip[data-filter="type"][data-value="all"]')?.classList.remove('active');

          if (chip.classList.contains('active')) {
            // 이미 선택된 칩은 해제
            chip.classList.remove('active');
          } else {
            // 새로 선택하려고 할 때 - 현재 선택된 개수 확인
            const currentlySelected = filterModal.querySelectorAll('.filter-chip[data-filter="type"].active:not([data-value="all"])').length;
            if (currentlySelected >= 2) {
              showToast('타입은 최대 2개까지 선택할 수 있습니다.');
            } else {
              chip.classList.add('active');
            }
          }

          // 선택된 타입이 없으면 '전체' 활성화
          const anyTypeSelected = filterModal.querySelectorAll('.filter-chip[data-filter="type"].active:not([data-value="all"])').length > 0;
          if (!anyTypeSelected) {
            filterModal.querySelector('.filter-chip[data-filter="type"][data-value="all"]')?.classList.add('active');
          }
        }
      } else if (filterType === 'generation') {
        // 세대는 다중 선택 가능
        if (value === 'all') {
          // '전체' 선택 시 다른 세대 모두 해제
          filterModal.querySelectorAll('.filter-chip[data-filter="generation"]').forEach(c => {
            c.classList.remove('active');
          });
          chip.classList.add('active');
        } else {
          // 특정 세대 선택 시 '전체' 해제
          filterModal.querySelector('.filter-chip[data-filter="generation"][data-value="all"]')?.classList.remove('active');
          chip.classList.toggle('active');

          // 선택된 세대가 없으면 '전체' 활성화
          const anyGenerationSelected = filterModal.querySelectorAll('.filter-chip[data-filter="generation"].active:not([data-value="all"])').length > 0;
          if (!anyGenerationSelected) {
            filterModal.querySelector('.filter-chip[data-filter="generation"][data-value="all"]')?.classList.add('active');
          }
        }
      } else if (filterType === 'habitat') {
        // 서식지는 다중 선택 가능
        if (value === 'all') {
          filterModal.querySelectorAll('.filter-chip[data-filter="habitat"]').forEach(c => {
            c.classList.remove('active');
          });
          chip.classList.add('active');
        } else {
          filterModal.querySelector('.filter-chip[data-filter="habitat"][data-value="all"]')?.classList.remove('active');
          chip.classList.toggle('active');

          const anyHabitatSelected = filterModal.querySelectorAll('.filter-chip[data-filter="habitat"].active:not([data-value="all"])').length > 0;
          if (!anyHabitatSelected) {
            filterModal.querySelector('.filter-chip[data-filter="habitat"][data-value="all"]')?.classList.add('active');
          }
        }
      } else {
        // 다른 필터들은 단일 선택
        filterModal.querySelectorAll(`.filter-chip[data-filter="${filterType}"]`).forEach(c => {
          c.classList.remove('active');
        });
        chip.classList.add('active');
      }
    });
  });

  // 완료 버튼
  if (filterApply) {
    filterApply.addEventListener('click', closeFilterModal);
  }

  // 초기화 버튼
  if (filterReset) {
    filterReset.addEventListener('click', () => {
      resetFilter();
    });
  }

  // 필터 활성화 배지 업데이트
  updateFilterBadge();
}

// 필터 모달 열기
function openFilterModal() {
  const filterModal = document.getElementById('pokemon-filter-modal');
  if (!filterModal) return;

  // 현재 필터 상태를 UI에 반영
  syncFilterUI();

  filterModal.style.display = 'flex';
  document.body.classList.add('modal-open');
  onModalOpen();
}

// 필터 UI 동기화
function syncFilterUI() {
  const favoritesToggle = document.getElementById('filter-favorites-toggle');
  const legendaryToggle = document.getElementById('filter-legendary-toggle');
  const mythicalToggle = document.getElementById('filter-mythical-toggle');
  const showFavoriteIconToggle = document.getElementById('filter-show-favorite-icon');

  // 즐겨찾기 토글
  if (favoritesToggle) {
    if (currentFilter.favoritesOnly) {
      favoritesToggle.classList.add('active');
    } else {
      favoritesToggle.classList.remove('active');
    }
  }

  // 전설 토글
  if (legendaryToggle) {
    if (currentFilter.legendaryOnly) {
      legendaryToggle.classList.add('active');
    } else {
      legendaryToggle.classList.remove('active');
    }
  }

  // 환상 토글
  if (mythicalToggle) {
    if (currentFilter.mythicalOnly) {
      mythicalToggle.classList.add('active');
    } else {
      mythicalToggle.classList.remove('active');
    }
  }

  // 각 칩 그룹 활성화 상태
  document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
    chip.classList.remove('active');
    const filterType = chip.dataset.filter;
    const value = chip.dataset.value;

    if (filterType === 'completion' && currentFilter.completion === value) {
      chip.classList.add('active');
    } else if (filterType === 'type') {
      // 타입: 배열이 비어있으면 'all', 아니면 해당 타입들 활성화
      if (currentFilter.types.length === 0 && value === 'all') {
        chip.classList.add('active');
      } else if (currentFilter.types.includes(value)) {
        chip.classList.add('active');
      }
    } else if (filterType === 'generation') {
      // 세대: 배열이 비어있으면 'all', 아니면 해당 세대들 활성화
      if (currentFilter.generations.length === 0 && value === 'all') {
        chip.classList.add('active');
      } else if (currentFilter.generations.includes(value)) {
        chip.classList.add('active');
      }
    } else if (filterType === 'habitat') {
      // 서식지: 배열이 비어있으면 'all', 아니면 해당 서식지들 활성화
      if (currentFilter.habitats.length === 0 && value === 'all') {
        chip.classList.add('active');
      } else if (currentFilter.habitats.includes(value)) {
        chip.classList.add('active');
      }
    } else if (filterType === 'sort' && currentFilter.sort === value) {
      chip.classList.add('active');
    }
  });
}

// 필터 적용
function applyFilter() {
  const favoritesToggle = document.getElementById('filter-favorites-toggle');
  const legendaryToggle = document.getElementById('filter-legendary-toggle');
  const mythicalToggle = document.getElementById('filter-mythical-toggle');
  const showFavoriteIconToggle = document.getElementById('filter-show-favorite-icon');

  // UI에서 필터 값 읽기
  currentFilter.favoritesOnly = favoritesToggle?.classList.contains('active') || false;
  currentFilter.legendaryOnly = legendaryToggle?.classList.contains('active') || false;
  currentFilter.mythicalOnly = mythicalToggle?.classList.contains('active') || false;

  // 완료 상태
  const completionChip = document.querySelector('.filter-chip[data-filter="completion"].active');
  currentFilter.completion = completionChip?.dataset.value || 'all';

  // 타입 (복수 선택)
  const activeTypeChips = document.querySelectorAll('.filter-chip[data-filter="type"].active:not([data-value="all"])');
  currentFilter.types = Array.from(activeTypeChips).map(chip => chip.dataset.value);

  // 세대 (복수 선택)
  const activeGenerationChips = document.querySelectorAll('.filter-chip[data-filter="generation"].active:not([data-value="all"])');
  currentFilter.generations = Array.from(activeGenerationChips).map(chip => chip.dataset.value);

  // 서식지 (복수 선택)
  const activeHabitatChips = document.querySelectorAll('.filter-chip[data-filter="habitat"].active:not([data-value="all"])');
  currentFilter.habitats = Array.from(activeHabitatChips).map(chip => chip.dataset.value);

  // 정렬
  const sortChip = document.querySelector('.filter-chip[data-filter="sort"].active');
  const newSort = sortChip?.dataset.value || 'default';
  const sortChanged = currentFilter.sort !== newSort;
  currentFilter.sort = newSort;

  // 저장
  saveFilterSettings();

  // 필터 배지 업데이트
  updateFilterBadge();

  // 아이콘 목록 새로고침 (정렬이 바뀌었으면 fetch 필요할 수 있음)
  if (sortChanged && (newSort === 'generation' || lastLoadedIconApiEndpoint?.includes('all-pokemon'))) {
    loadUserPokemonIcons();
  } else {
    updateUserPokemonIconsUI();
  }

  showToast('필터가 적용되었습니다.');
}

// 필터 초기화
function resetFilter() {
  currentFilter = {
    ...currentFilter,
    favoritesOnly: false,
    completion: 'all',
    types: [],
    habitats: [],
    generations: [],
    sort: 'default',
    searchQuery: ''
  };

  saveFilterSettings();
  syncFilterUI();
  updateFilterBadge();

  // 검색창 UI 초기화
  if (iconSearchInput) iconSearchInput.value = '';
  if (iconSearchContainer) iconSearchContainer.classList.remove('active');

  loadUserPokemonIcons();

  showToast('필터가 초기화되었습니다.');
}

// 필터 활성화 배지 업데이트
function updateFilterBadge() {
  const badge = document.getElementById('filterActiveBadge');
  const filterBtn = document.getElementById('filterIconsBtn');

  if (!badge || !filterBtn) return;

  // 기본값이 아닌 필터가 있으면 배지 표시
  const hasActiveFilter =
    currentFilter.favoritesOnly ||
    currentFilter.legendaryOnly ||
    currentFilter.mythicalOnly ||
    currentFilter.completion !== 'all' ||
    currentFilter.types.length > 0 ||
    currentFilter.habitats.length > 0 ||
    currentFilter.generations.length > 0 ||
    currentFilter.sort !== 'default';

  if (hasActiveFilter) {
    badge.style.display = 'block';
    filterBtn.classList.add('active');
  } else {
    badge.style.display = 'none';
    filterBtn.classList.remove('active');
  }
}

// 필터링된 포켓몬 목록 가져오기
function getFilteredPokemonList(icons) {
  if (!icons || icons.length === 0) return [];

  let filtered = [...icons];
  const query = (currentFilter.searchQuery || '').toLowerCase().trim();

  // 0. 검색 필터 (aria-label 기준 검색 요청에 따라 이름/이미지명 검색)
  if (query) {
    filtered = filtered.filter(icon => {
      const name = (icon.name || icon.base_image_name || '').toLowerCase();
      return name.includes(query);
    });
  }

  // 1. 즐겨찾기 필터
  if (currentFilter.favoritesOnly) {
    filtered = filtered.filter(icon => icon.is_favorite);
  }

  // 1.5. 전설/환상 필터
  if (currentFilter.legendaryOnly && currentFilter.mythicalOnly) {
    // 둘 다 선택된 경우: 전설 OR 환상
    filtered = filtered.filter(icon => icon.is_legendary || icon.is_mythical);
  } else {
    // 개별 선택인 경우 (둘 중 하나만 선택 or 둘 다 미선택)
    if (currentFilter.legendaryOnly) {
      filtered = filtered.filter(icon => icon.is_legendary);
    }
    if (currentFilter.mythicalOnly) {
      filtered = filtered.filter(icon => icon.is_mythical);
    }
  }

  // 1.8. 서식지 필터 (OR 검색)
  if (currentFilter.habitats.length > 0) {
    filtered = filtered.filter(icon => {
      return currentFilter.habitats.includes(icon.habitat);
    });
  }

  // 2. 완료 상태 필터
  if (currentFilter.completion === 'complete') {
    filtered = filtered.filter(icon => (icon.completion_percentage || 0) >= 100);
  } else if (currentFilter.completion === 'incomplete') {
    filtered = filtered.filter(icon => (icon.completion_percentage || 0) < 100);
  }

  // 3. 타입 필터 (복수 선택 가능)
  if (currentFilter.types.length > 0) {
    filtered = filtered.filter(icon => {
      // 선택된 모든 타입을 포함하는 포켓몬만 표시 (AND 검색)
      return currentFilter.types.every(selectedType =>
        icon.type1 === selectedType || icon.type2 === selectedType
      );
    });
  }

  // 4. 세대 필터 (복수 선택 가능)
  if (currentFilter.generations.length > 0) {
    filtered = filtered.filter(icon => {
      // 선택된 세대 중 하나라도 일치하면 표시
      return currentFilter.generations.includes(icon.generation?.toString());
    });
  }

  // 4. 정렬
  if (currentFilter.sort === 'progress-low') {
    filtered.sort((a, b) => (a.completion_percentage || 0) - (b.completion_percentage || 0));
  } else if (currentFilter.sort === 'recent') {
    filtered.sort((a, b) => {
      const dateA = new Date(a.obtained_date || 0);
      const dateB = new Date(b.obtained_date || 0);
      return dateB - dateA; // 최신순
    });
  } else if (currentFilter.sort === 'generation') {
    // 세대별 정렬: 세대 → 포켓몬ID → 이로치는 일반 뒤로
    filtered.sort((a, b) => {
      const genA = a.generation || 1;
      const genB = b.generation || 1;
      if (genA !== genB) return genA - genB;
      // 같은 세대 내에서는 포켓몬ID순
      const pokemonIdA = a.pokemon_id || 0;
      const pokemonIdB = b.pokemon_id || 0;
      if (pokemonIdA !== pokemonIdB) return pokemonIdA - pokemonIdB;
      // 같은 포켓몬이면 일반이 먼저, 이로치가 뒤로
      const shinyA = a.is_shiny ? 1 : 0;
      const shinyB = b.is_shiny ? 1 : 0;
      return shinyA - shinyB;
    });
  }
  // 'default'는 서버에서 반환된 순서 그대로

  return filtered;
}

// 전역 함수 노출
window.openFilterModal = openFilterModal;
window.applyFilter = applyFilter;
window.resetFilter = resetFilter;

// 트레이드 숍 모달 관련
const shopModal = document.getElementById('shop-modal');
const shopCloseBtn = document.getElementById('shop-close');

// 트레이드 숍 레시피 정의
const shopRecipes = [
  { cost: 'Mystic Charm', costCount: 1, reward: 'Shiny Charm', rewardCount: 1 },
  { cost: 'Rare Candy', costCount: 1, reward: 'Shiny Charm', rewardCount: 2 },
  { cost: 'Oval Charm', costCount: 1, reward: 'Shiny Charm', rewardCount: 3 },
  { cost: 'Shiny Charm', costCount: 5, reward: 'Brilliance Charm', rewardCount: 1 },
  { cost: 'Mystic Charm', costCount: 2, reward: 'Awakening Charm', rewardCount: 1 },
];

// 아이템 정보 캐시
let shopItemsCache = null;

async function loadShopItems() {
  if (shopItemsCache) return shopItemsCache;

  try {
    const response = await fetch('/api/shop/items');
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        shopItemsCache = result.data;
        return result.data;
      }
    }
  } catch (e) {
    console.error('Failed to load shop items:', e);
  }
  return [];
}

// 상점 아이템 렌더링용 유저 아이템 캐시
let shopUserItemsCache = null;

async function renderShopItems() {
  const grid = document.getElementById('shop-items-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="text-align:center; padding:20px;">로딩 중...</div>';

  const items = await loadShopItems();
  const userItems = await fetchUserItems();
  shopUserItemsCache = userItems;

  // 아이템 이름으로 정보 찾기 위한 맵 생성
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.name] = item;
  });

  grid.innerHTML = '';

  shopRecipes.forEach(recipe => {
    const rewardItem = itemMap[recipe.reward];
    const costItem = itemMap[recipe.cost];

    if (!rewardItem || !costItem) return;

    // 재료 보유량 확인
    const userCostCount = userItems[recipe.cost]?.quantity || 0;
    const canAfford = userCostCount >= recipe.costCount;

    const card = document.createElement('div');
    card.className = `shop-item-card${!canAfford ? ' insufficient' : ''}`;

    // 이미지 경로 생성 (IMAGE_URLS 사용 또는 DB image_name 사용)
    // 여기서는 DB image_name을 사용하여 경로 구성
    const rewardImgUrl = `${ASSETS_BASE_URL}/custom/img/items/${rewardItem.image_name}.webp`;
    const costImgUrl = `${ASSETS_BASE_URL}/custom/img/items/${costItem.image_name}.webp`;

    card.innerHTML = `
      <div class="shop-item-icon">
        <img src="${rewardImgUrl}" alt="${rewardItem.name_ko}">
        ${recipe.rewardCount > 1 ? `<span class="item-count-badge">x${recipe.rewardCount}</span>` : ''}
      </div>
      <div class="shop-item-info">
        <h4>${rewardItem.name_ko} ${recipe.rewardCount > 1 ? `x${recipe.rewardCount}` : ''}</h4>
        <p class="shop-item-desc">${rewardItem.description || ''}</p>
      </div>
      <div class="shop-item-price">
        <div class="price-row">
          <img src="${costImgUrl}" alt="${costItem.name_ko}" width="20">
          <span>x${recipe.costCount}</span>
        </div>
      </div>
      <button class="shop-buy-btn${!canAfford ? ' disabled' : ''}" ${!canAfford ? 'disabled' : ''}>
        ${canAfford ? '교환' : '부족'}
      </button>
    `;

    // 이벤트 리스너 추가 (활성화된 경우만)
    if (canAfford) {
      const buyBtn = card.querySelector('.shop-buy-btn');
      buyBtn.onclick = () => exchangeItem(recipe.cost, recipe.costCount, recipe.reward, recipe.rewardCount, userCostCount);
    }

    grid.appendChild(card);
  });
}

// 보유 아이템 렌더링 (한줄 형태)
async function renderMyItems() {
  const container = document.getElementById('my-items-list');
  if (!container) return;

  const items = await loadShopItems();
  const userItems = await fetchUserItems();

  // 아이템 정보로 맵 생성
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.name] = item;
  });

  // shopRecipes에서 사용되는 아이템만 표시
  const relevantItems = new Set();
  shopRecipes.forEach(recipe => {
    relevantItems.add(recipe.cost);
    relevantItems.add(recipe.reward);
  });

  container.innerHTML = '';

  relevantItems.forEach(itemName => {
    const itemInfo = itemMap[itemName];
    if (!itemInfo) return;

    const count = userItems[itemName]?.quantity || 0;
    const imgUrl = `${ASSETS_BASE_URL}/custom/img/items/${itemInfo.image_name}.webp`;

    const item = document.createElement('div');
    item.className = 'my-item-inline';
    item.innerHTML = `
      <img src="${imgUrl}" alt="${itemInfo.name_ko}" title="${itemInfo.name_ko}">
      <span>${count}</span>
    `;
    container.appendChild(item);
  });
}

function openShopModal() {
  if (shopModal) {
    shopModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    onModalOpen();
    renderShopItems();
    renderMyItems();
  }
}

function closeShopModal() {
  if (shopModal) {
    shopModal.style.display = 'none';
    document.body.style.overflow = '';
    onModalClose();
  }
}

if (shopCloseBtn) {
  shopCloseBtn.addEventListener('click', closeShopModal);
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
  if (e.target === shopModal) {
    closeShopModal();
  }
});

// 아이템 교환 함수
async function exchangeItem(costItemName, costAmount, rewardItemName, rewardAmount, userCostCount) {
  if (!currentUserId) {
    showToast('로그인이 필요합니다.');
    return;
  }

  // 아이템 정보 가져오기 (이름 번역용)
  const items = await loadShopItems();
  const itemMap = {};
  items.forEach(item => itemMap[item.name] = item);

  const costItemInfo = itemMap[costItemName];
  const rewardItemInfo = itemMap[rewardItemName];

  const costNameKo = costItemInfo ? costItemInfo.name_ko : costItemName;
  const rewardNameKo = rewardItemInfo ? rewardItemInfo.name_ko : rewardItemName;

  const costImgUrl = costItemInfo ? `${ASSETS_BASE_URL}/custom/img/items/${costItemInfo.image_name}.webp` : '';
  const rewardImgUrl = rewardItemInfo ? `${ASSETS_BASE_URL}/custom/img/items/${rewardItemInfo.image_name}.webp` : '';

  // 보유량 가져오기 (캐시 또는 실시간)
  const currentUserItems = shopUserItemsCache || await fetchUserItems();
  const currentCostOwned = currentUserItems[costItemName]?.quantity || 0;
  const currentRewardOwned = currentUserItems[rewardItemName]?.quantity || 0;

  // 최대 교환 가능 수량 계산
  const maxExchangeCount = Math.floor(currentCostOwned / costAmount);
  let exchangeQuantity = 1;

  // 수량 업데이트 함수
  const updateQuantityDisplay = () => {
    const qtyDisplay = document.getElementById('exchange-quantity');
    const minusBtn = document.getElementById('exchange-minus');
    const plusBtn = document.getElementById('exchange-plus');
    const costDisplay = document.getElementById('exchange-cost-count');
    const rewardDisplay = document.getElementById('exchange-reward-count');
    const afterCost = document.getElementById('exchange-after-cost');
    const afterReward = document.getElementById('exchange-after-reward');

    if (qtyDisplay) qtyDisplay.textContent = exchangeQuantity;
    if (minusBtn) minusBtn.disabled = exchangeQuantity <= 1;
    if (plusBtn) plusBtn.disabled = exchangeQuantity >= maxExchangeCount;
    if (costDisplay) costDisplay.textContent = `x${costAmount * exchangeQuantity}`;
    if (rewardDisplay) rewardDisplay.textContent = `x${rewardAmount * exchangeQuantity}`;
    if (afterCost) afterCost.textContent = `${currentCostOwned} → ${currentCostOwned - (costAmount * exchangeQuantity)}`;
    if (afterReward) afterReward.textContent = `${currentRewardOwned} → ${currentRewardOwned + (rewardAmount * exchangeQuantity)}`;
  };

  // Sanitize names
  const safeCostName = escapeHtml(costNameKo);
  const safeRewardName = escapeHtml(rewardNameKo);

  // 확인 모달 표시
  const confirmed = await showConfirmModal(
    '아이템 교환',
    `<div style="text-align: center;">
       <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 16px;">
         <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
           <span style="font-size: 10px; color: #CD5C5C; font-weight: 600; background: #FFF5F5; padding: 2px 8px; border-radius: 4px;">소모</span>
           <div style="width: 56px; height: 56px; background: #fef2f2; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #fecaca; position: relative;">
             <img src="${costImgUrl}" width="36" height="36" style="object-fit: contain;" onerror="this.style.display='none'">
           </div>
           <span id="exchange-cost-count" style="font-size: 13px; color: #CD5C5C; font-weight: 600;">x${costAmount}</span>
           <span style="font-size: 11px; color: #666;">${safeCostName}</span>
           <span id="exchange-after-cost" style="font-size: 10px; color: #999;">${currentCostOwned} → ${currentCostOwned - costAmount}</span>
         </div>
         <div style="color: #cbd5e0; margin-top: -24px;">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
           </svg>
         </div>
         <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
           <span style="font-size: 10px; color: #185888; font-weight: 600; background: #E6F0F6; padding: 2px 8px; border-radius: 4px;">획득</span>
           <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #a7f3d0; position: relative;">
             <img src="${rewardImgUrl}" width="36" height="36" style="object-fit: contain;" onerror="this.style.display='none'">
           </div>
           <span id="exchange-reward-count" style="font-size: 13px; color: #185888; font-weight: 600;">x${rewardAmount}</span>
           <span style="font-size: 11px; color: #666;">${safeRewardName}</span>
           <span id="exchange-after-reward" style="font-size: 10px; color: #999;">${currentRewardOwned} → ${currentRewardOwned + rewardAmount}</span>
         </div>
       </div>
       ${maxExchangeCount > 1 ? `
       <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0; padding: 10px; background: #f8fafc; border-radius: 8px;">
         <span style="font-size: 12px; color: #666;">교환 수량</span>
         <button id="exchange-minus" style="width: 28px; height: 28px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;" disabled>−</button>
         <span id="exchange-quantity" style="font-size: 16px; font-weight: 600; min-width: 24px; text-align: center;">1</span>
         <button id="exchange-plus" style="width: 28px; height: 28px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;" ${maxExchangeCount <= 1 ? 'disabled' : ''}>＋</button>         
       </div>
       ` : ''}
     </div>`,
    () => {
      // 모달이 열린 후 이벤트 바인딩
      setTimeout(() => {
        const minusBtn = document.getElementById('exchange-minus');
        const plusBtn = document.getElementById('exchange-plus');
        if (minusBtn) {
          minusBtn.onclick = () => {
            if (exchangeQuantity > 1) {
              exchangeQuantity--;
              updateQuantityDisplay();
            }
          };
        }
        if (plusBtn) {
          plusBtn.onclick = () => {
            if (exchangeQuantity < maxExchangeCount) {
              exchangeQuantity++;
              updateQuantityDisplay();
            }
          };
        }
      }, 50);
    }
  );

  if (!confirmed) return;

  const totalCost = costAmount * exchangeQuantity;
  const totalReward = rewardAmount * exchangeQuantity;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/user/exchange', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        // userId extracted from token
        costItemName: costItemName,
        costAmount: totalCost,
        rewardItemName: rewardItemName,
        rewardAmount: totalReward
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast(`${rewardNameKo} ${totalReward}개 교환 완료!`);
      // 아이템 보유량 UI 갱신
      shopUserItemsCache = null;
      renderShopItems();
      renderMyItems();
    } else {
      showToast(result.error || '교환 실패');
    }
  } catch (err) {
    console.error('Exchange error:', err);
    showToast('오류가 발생했습니다.');
  }
}

// 전역 스코프에 함수 노출
window.openShopModal = openShopModal;
window.exchangeItem = exchangeItem;
window.resetFilter = resetFilter;

// 주간 날짜 범위 계산 함수
function updateWeekRanges() {
  const today = new Date();

  // 지난주: 최근 7일 (오늘 포함)
  const lastWeekEnd = new Date(today);
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(today.getDate() - 7);

  // 전전주: 지난주 이전 7일
  const previousWeekEnd = new Date(today);
  previousWeekEnd.setDate(today.getDate() - 8);
  const previousWeekStart = new Date(today);
  previousWeekStart.setDate(today.getDate() - 14);

  // 포맷팅: MM/DD
  const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

  const lastWeekEl = document.getElementById('lastWeekRange');
  const previousWeekEl = document.getElementById('previousWeekRange');

  if (lastWeekEl) {
    lastWeekEl.textContent = `${formatDate(lastWeekStart)} ~ ${formatDate(lastWeekEnd)}`;
  }
  if (previousWeekEl) {
    previousWeekEl.textContent = `${formatDate(previousWeekStart)} ~ ${formatDate(previousWeekEnd)}`;
  }
}

// 어제 날짜 설정 함수
function setYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // YYYY-MM-DD 형식으로 변환 (hidden input용)
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayStr = `${year}-${month}-${day}`;

  // 날짜 입력 필드에 기본값 설정 (hidden)
  const dateInput = document.getElementById('screenTimeDate');
  if (dateInput) {
    dateInput.value = yesterdayStr;
  }

  // 요일 배열 (한국어)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = dayNames[yesterday.getDay()];

  // 표시용 텍스트 업데이트 (예: "12월 4일 (목)")
  const yesterdayDateEl = document.getElementById('yesterdayDate');
  if (yesterdayDateEl) {
    yesterdayDateEl.textContent = `${yesterday.getMonth() + 1}월 ${yesterday.getDate()}일 (${dayOfWeek})`;
  }
}

// 스크린타임 코드 입력 헬퍼 함수들
function getScreenTimeCodeValue() {
  const digits = [];
  for (let i = 1; i <= 4; i++) {
    const digit = document.getElementById(`screenTimeDigit${i}`);
    if (digit && digit.value) {
      digits.push(digit.value);
    }
  }
  return digits.length > 0 ? parseInt(digits.join('')) : NaN;
}

function clearScreenTimeCodeInputs() {
  for (let i = 1; i <= 4; i++) {
    const digit = document.getElementById(`screenTimeDigit${i}`);
    if (digit) {
      digit.value = '';
    }
  }
  updateScreenTimePreview();
}

function updateScreenTimePreview() {
  const preview = document.getElementById('screenTimePreview');
  if (!preview) return;

  const code = getScreenTimeCodeValue();
  if (isNaN(code)) {
    preview.textContent = '';
    return;
  }

  const codeStr = code.toString();
  let hours, minutes;

  const isOver10HoursChecked = document.getElementById('isOver10Hours')?.checked || false;

  if (codeStr.length === 4) {
    // 4자리: 첫 2자리가 시간, 뒤 2자리가 분
    hours = parseInt(codeStr.substring(0, 2));
    minutes = parseInt(codeStr.substring(2, 4));
  } else if (codeStr.length === 3) {
    if (isOver10HoursChecked) {
      // 10시간 이상: 첫 2자리가 시간, 마지막 1자리가 분
      hours = parseInt(codeStr.substring(0, 2));
      minutes = parseInt(codeStr.substring(2, 3));
    } else {
      // 10시간 미만: 첫 1자리가 시간, 뒤 2자리가 분
      hours = parseInt(codeStr.substring(0, 1));
      minutes = parseInt(codeStr.substring(1, 3));
    }
  } else if (codeStr.length === 2) {
    // 2자리: 분만 (에러 검사는 저장 시 수행)
    hours = 0;
    minutes = code;
  } else if (codeStr.length === 1) {
    // 1자리: 분만 (입력 중이므로 미리보기만)
    hours = 0;
    minutes = code;
  } else {
    preview.textContent = '';
    return;
  }

  // 3자리 이상일 때만 분 에러 표시 (2자리 이하 입력 중에는 UX 저해)
  if (minutes >= 60) {
    preview.textContent = '⚠️ 분은 59 이하여야 합니다';
    preview.style.color = '#EF4444';
  } else if (hours >= 24) {
    preview.textContent = '⚠️ 24시간을 넘을 수 없습니다';
    preview.style.color = '#EF4444';
  } else {
    preview.textContent = `📱 ${hours}시간 ${minutes}분`;
    preview.style.color = '#CD5C5C';
  }
}

function setupScreenTimeCodeInputs() {
  const digitInputs = [];
  for (let i = 1; i <= 4; i++) {
    const input = document.getElementById(`screenTimeDigit${i}`);
    if (input) {
      digitInputs.push(input);
    }
  }

  digitInputs.forEach((input, index) => {
    // 숫자만 입력 허용
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      // 숫자가 아니면 제거
      if (!/^\d*$/.test(value)) {
        e.target.value = value.replace(/\D/g, '');
        return;
      }

      // 값이 입력되면 다음 칸으로 이동
      if (value && index < digitInputs.length - 1) {
        digitInputs[index + 1].focus();
      }

      updateScreenTimePreview();
    });

    // 백스페이스: 이전 칸으로 이동
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        // 현재 칸이 비어있으면 이전 칸으로 이동하고 그 값을 지움
        if (!e.target.value && index > 0) {
          digitInputs[index - 1].focus();
          digitInputs[index - 1].value = '';
        }
        // 약간의 딜레이 후 프리뷰 업데이트 (값이 지워진 후에 업데이트)
        setTimeout(() => updateScreenTimePreview(), 0);
      }
      // 왼쪽 화살표
      if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        digitInputs[index - 1].focus();
      }
      // 오른쪽 화살표
      if (e.key === 'ArrowRight' && index < digitInputs.length - 1) {
        e.preventDefault();
        digitInputs[index + 1].focus();
      }
    });

    // 붙여넣기 처리
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);

      for (let i = 0; i < pastedData.length && (index + i) < digitInputs.length; i++) {
        digitInputs[index + i].value = pastedData[i];
      }

      // 마지막 입력된 칸의 다음 칸으로 포커스 이동
      const nextIndex = Math.min(index + pastedData.length, digitInputs.length - 1);
      digitInputs[nextIndex].focus();

      updateScreenTimePreview();
    });

    // 포커스 시 전체 선택
    input.addEventListener('focus', () => {
      input.select();
    });
  });

  // 10시간 이상 체크박스 변경 시 미리보기 업데이트
  const isOver10HoursCheckbox = document.getElementById('isOver10Hours');
  if (isOver10HoursCheckbox) {
    isOver10HoursCheckbox.addEventListener('change', updateScreenTimePreview);
  }
}

// 스크린타임 저장 버튼
const submitScreenTimeBtn = document.getElementById('submitScreenTimeBtn');
if (submitScreenTimeBtn) {
  submitScreenTimeBtn.addEventListener('click', async () => {
    try {
      // 게스트 모드 체크 (가장 먼저)
      if (window.isGuest()) {
        showToast('체험 모드에서는 저장할 수 없습니다.');
        return;
      }

      // 주간 검증 확인 (추가)
      if (!checkScreenTimeInputAllowed()) {
        return; // 검증 필요 시 차단
      }

      const userId = window.getCurrentUserId ? window.getCurrentUserId() : null;
      if (!userId) {
        showToast('로그인이 필요합니다.');
        return;
      }

      // 입력값 가져오기
      const dateInput = document.getElementById('screenTimeDate').value;
      const usageCodeInput = getScreenTimeCodeValue();
      const isOver10HoursChecked = document.getElementById('isOver10Hours').checked;

      // 유효성 검사
      if (!dateInput) {
        showToast('날짜를 선택해주세요.');
        return;
      }

      if (isNaN(usageCodeInput) || usageCodeInput < 0) {
        showToast('사용 시간을 올바르게 입력해주세요.');
        return;
      }

      // 코드 자릿수 확인 (2-4자리)
      const codeStr = usageCodeInput.toString();
      if (codeStr.length < 2) {
        showToast('최소 2자리 이상 입력해주세요.\n(예: 35 = 35분, 135 = 1시간 35분)');
        return;
      }
      if (codeStr.length > 4) {
        showToast('사용 시간은 최대 4자리 숫자로 입력해주세요.\n(예: 1035 = 10시간 35분)');
        return;
      }

      // 10시간 이상 여부: 체크박스 우선, 또는 4자리 숫자 자동 판별
      const isOver10Hours = isOver10HoursChecked || usageCodeInput >= 1000;

      console.log('스크린타임 저장 요청:', {
        date: dateInput,
        usageCode: usageCodeInput,
        isOver10Hours: isOver10Hours
      });

      // usageCode 방식으로 API 호출 (백엔드에서 파싱 및 보상 처리)
      const headers = await getAuthHeaders();
      const response = await fetch('/api/screen-time', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          date: dateInput,
          usageCode: usageCodeInput,
          isOver10Hours: isOver10Hours
        })
      });

      let data = null;
      let error = null;

      if (response.ok) {
        const result = await response.json();
        data = result.data || result;
      } else {
        const errResult = await response.json();
        error = { message: errResult.error || 'Failed to save screen time' };
      }

      if (error) {
        console.error('스크린타임 저장 오류:', error);
        showToast(error.message);
        return;
      }

      console.log('스크린타임 저장 성공:', data);

      // 결과 표시
      // 결과 표시 요소 가져오기
      const resultDiv = document.getElementById('screenTimeResult');

      let modalShown = false;

      // 보상 획득 모달 표시 시도
      if (data.isNewEntry && data.rewards) {
        const hasRewards = (data.rewards.pokemons && data.rewards.pokemons.length > 0) ||
          (data.rewards.items && data.rewards.items.length > 0);
        if (hasRewards) {
          const comparisonResult = data.weeklyComparison?.comparisonResult || null;
          showRewardResultModal(data.rewards, comparisonResult, data.eventName);
          modalShown = true;
          // 모달이 뜨면 텍스트 결과는 숨김 (또는 필요시 표시하지 않음)
          resultDiv.style.display = 'none';
        }
      }
      // 입력 필드 초기화
      clearScreenTimeCodeInputs();
      document.getElementById('isOver10Hours').checked = false;

      // 어제 날짜로 다시 설정
      setYesterdayDate();

      // 스크린타임 모달 닫기
      if (typeof closeScreenTimeModal === 'function') closeScreenTimeModal();

      // 주간 달성 바 업데이트
      if (typeof updateWeeklyAchievementBar === 'function') updateWeeklyAchievementBar();

      // 오늘의 포켓몬 및 수면 상태 갱신 (새로운 포켓몬 획득 시 홈화면 업데이트)
      if (data.isNewEntry && data.rewards) {
        const hasPokemons = data.rewards.pokemons && data.rewards.pokemons.length > 0;
        if (hasPokemons) {
          if (typeof loadTodayObtainedPokemon === 'function') loadTodayObtainedPokemon();
          if (window.sleepTracker && typeof window.sleepTracker.loadSleepStatus === 'function') {
            await window.sleepTracker.loadSleepStatus();
          }
        }
      }

    } catch (err) {
      console.error('스크린타임 저장 중 예외 발생:', err);
      showToast('스크린타임 저장 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
  });
}

// 감소율 검증 버튼
const validateReductionBtn = document.getElementById('validateReductionBtn');
if (validateReductionBtn) {
  validateReductionBtn.addEventListener('click', async () => {
    try {
      const userData = { user: window.getCurrentUserId ? { id: window.getCurrentUserId() } : null };
      const userError = null;
      if (!userData?.user) {
        if (window.isGuest()) {
          showToast('체험 모드에서는 검증할 수 없습니다.');
          return;
        }
        showToast('로그인이 필요합니다.');
        return;
      }

      const reductionInput = document.getElementById('reductionPercent');
      const reductionPercent = parseInt(reductionInput.value);

      if (isNaN(reductionPercent) || reductionPercent < 0 || reductionPercent > 100) {
        showToast('0~100 사이의 숫자를 입력해주세요.');
        return;
      }

      // 백엔드 함수 호출 (fetch 사용)
      // validate_screen_time_reduction RPC 대체 필요
      console.warn('Validation API endpoint not implemented yet');
      /*
      const { data, error } = await supabaseClient.rpc('validate_screen_time_reduction', {
          p_user_id: userData.user.id,
          p_claimed_reduction_percent: reductionPercent
      });
      */
      // 임시 에러 처리
      const data = null;
      const error = { message: 'API not implemented' };

      if (error) {
        console.error('검증 오류:', error);
        showToast('검증 중 오류가 발생했습니다: ' + error.message);
        return;
      }

      console.log('검증 결과:', data);

      // 결과 표시
      const resultDiv = document.getElementById('validationResult');
      resultDiv.style.display = 'block';

      if (data.is_fraud) {
        // 부정 기입
        resultDiv.className = 'result-message result-error';
        resultDiv.innerHTML = `
            <strong>⚠️ 부정 기입 감지!</strong><br>
            ${data.message}<br>
            <small>실제 감소율: ${data.actual_reduction_percent}% | 입력한 감소율: ${data.claimed_reduction_percent}%</small>
          `;
      } else if (data.is_valid && data.reward_given) {
        // 검증 성공 + 보상 지급
        resultDiv.className = 'result-message result-success';
        resultDiv.innerHTML = `
            <strong>🎉 검증 성공!</strong><br>
            ${data.message}<br>
            <strong>보상: ${data.reward_item}</strong> 1개 획득!<br>
            <small>실제 감소율: ${data.actual_reduction_percent}%</small>
          `;
      } else if (data.is_valid) {
        // 검증 성공 (보상은 없음)
        resultDiv.className = 'result-message result-info';
        resultDiv.innerHTML = `
            <strong>✓ 검증 성공</strong><br>
            ${data.message}<br>
            <small>실제 감소율: ${data.actual_reduction_percent}%</small>
          `;
      } else {
        // 검증 실패
        resultDiv.className = 'result-message result-warning';
        resultDiv.innerHTML = `
            <strong>❌ 검증 실패</strong><br>
            ${data.message}<br>
            <small>실제 감소율: ${data.actual_reduction_percent}% | 입력한 감소율: ${data.claimed_reduction_percent}%</small><br>
            <small>차이가 ±2% 범위를 벗어났습니다.</small>
          `;
      }

      // 입력 필드 초기화
      reductionInput.value = '';

    } catch (err) {
      console.error('검증 중 예외 발생:', err);
      showToast('검증 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
  });
}



// 페이지 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 스크린타임 코드 입력 셋업
  setupScreenTimeCodeInputs();

  // 스크린타임 관련 리스너 (기존 코드에 있음)
  if (typeof updateWeekRanges === 'function') updateWeekRanges();
  if (typeof setYesterdayDate === 'function') setYesterdayDate();

  // Initialize Tab Navigation
  initTabNavigation();
});

// ==========================================
// Tab Navigation Logic
// ==========================================

function initTabNavigation() {
  const tabItems = document.querySelectorAll('.tab-item');
  const tabViews = document.querySelectorAll('.tab-view');

  if (!tabItems.length || !tabViews.length) {
    console.warn('Tab navigation elements not found.');
    return;
  }

  tabItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      // 1. Get the target tab name
      const targetTab = item.closest('.tab-item').dataset.tab;

      if (!targetTab) return;

      // 2. Update Tab Items UI
      tabItems.forEach(tab => {
        if (tab.dataset.tab === targetTab) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // 3. Update Tab Views
      tabViews.forEach(view => {
        if (view.id === `view-${targetTab}`) {
          view.classList.add('active');
          view.style.display = 'block'; // Ensure it's visible

          // Trigger a resize event to ensure layout updates
          window.dispatchEvent(new Event('resize'));

          // Load data for specific tabs
          if (targetTab === 'pokedex') {
            // 이미 로드되었으면 재요청 방지
            if (!window.isPokedexLoaded && typeof loadUserPokemonIcons === 'function') {
              loadUserPokemonIcons();
            }
          }

          // 수면 탭 데이터 로드
          if (targetTab === 'sleep') {
            if (window.sleepTracker && (!window.sleepTracker.sleepStatusLoaded || !window.sleepTracker.sleepStatus)) {
              console.log('Reloading sleep status for sleep tab');
              window.sleepTracker.loadSleepStatus();
            }
          }
        } else {
          view.classList.remove('active');
          view.style.display = 'none';
        }
      });

      // PWA 배너 가시성 업데이트
      if (typeof window.updatePwaBannerVisibility === 'function') {
        window.updatePwaBannerVisibility();
      }
    });
  });

  // Initialize: Show the active tab (default to home if none active)
  const activeTab = document.querySelector('.tab-item.active');
  if (activeTab) {
    // Manually trigger the logic for the active tab without full click simulation if preferred,
    // but clicking is the easiest way to ensure all logic runs.
    // However, we need to be careful if the click handler toggles things.
    // Our handler sets state based on the tab, so it's idempotent.
    const targetTab = activeTab.dataset.tab;
    tabViews.forEach(view => {
      if (view.id === `view-${targetTab}`) {
        view.classList.add('active');
        view.style.display = 'block';
      } else {
        view.classList.remove('active');
        view.style.display = 'none';
      }
    });
  }
}

// 게스트 모드 UI 설정 함수
function setupGuestModeUI() {
  // 저장 관련 버튼들에 비활성화 스타일 적용
  const saveButtons = [
    'submitScreenTimeBtn',      // 스크린타임 저장
    'validateScreenTimeBtn',    // 스크린타임 검증
    'submitSleepBtn'            // 수면 저장
  ];

  saveButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.add('guest-disabled');
    }
  });

  // 게스트 모드 안내 배너 표시 (있는 경우)
  const guestBanners = document.querySelectorAll('.guest-mode-banner');
  guestBanners.forEach(banner => banner.classList.add('visible'));

  // 알 획득 관련 UI도 안내 표시
  const eggSearchInput = document.getElementById('eggSearchInput');
  if (eggSearchInput) {
    eggSearchInput.placeholder = '🔍 알 검색 (체험모드: 조회만 가능)';
  }
}

// 탭 상태 및 데이터 리스트 초기화 (로그인/로그아웃 시 호출)
function resetTabState() {
  console.log('Resetting all tab states and data lists');
  window.isPokedexLoaded = false;
  lastLoadedIconApiEndpoint = null;

  if (window.sleepTracker) {
    window.sleepTracker.sleepStatusLoaded = false;
    window.sleepTracker.sleepStatus = null;
  }

  // 데이터 리스트 초기화 (네비게이션 및 UI 잔상 방지)
  userPokemonList = [];
  todayPokemonList = [];
  sleepPokemonList = [];
  homeFavorites = [];
}

// 게스트 모드 UI 해제 함수 (로그인 시 호출)
function clearGuestModeUI() {
  // 탭 상태 및 데이터 초기화 우선 실행
  resetTabState();

  const saveButtons = [
    'submitScreenTimeBtn',
    'validateScreenTimeBtn',
    'submitSleepBtn'
  ];

  saveButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.remove('guest-disabled');
    }
  });

  const eggSearchInput = document.getElementById('eggSearchInput');
  if (eggSearchInput) {
    eggSearchInput.placeholder = '🔍 알 검색...';
  }
}

// ==========================================
// Sleep Mode Logic (v2.0 - with Rewards)
// ==========================================
class SleepTracker {
  constructor() {
    this.storageKey = 'sleepSession';
    this.queueKey = 'sleepSyncQueue';
    this.wakeLock = null;
    this.timerInterval = null;
    this.wakeUpTimeout = null;
    this.sleepStatus = null;
    this.sleepStatusLoaded = false; // 로드 상태 플래그

    this.elements = {
      startBtn: document.getElementById('startSleepBtn'),
      stopBtn: document.getElementById('stopSleepBtn'),

      overlay: document.getElementById('sleepOverlay'),
      timer: document.getElementById('sleepTimer'),

      percentageText: document.getElementById('currentPercentage'),
      holidayRuleText: document.getElementById('holidayRuleText'),
      sleepTimePrefix: document.getElementById('sleepTimePrefix'),
      pokemonIcons: document.getElementById('sleepPokemonIcons'),
      message: document.getElementById('sleepMessage')
    };

    this.init();
  }

  init() {
    if (this.elements.startBtn) {
      this.elements.startBtn.addEventListener('click', () => this.startSleep());
    }
    if (this.elements.stopBtn) {
      this.elements.stopBtn.addEventListener('click', () => this.finishSleep());
    }

    // Handle Window Resize for snake connectors
    window.addEventListener('resize', () => this.handleResize());


    // Setup Mascots (Komala & Musharna)
    this.setupMascots();

    // Visibility Change Listener
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.handleVisibleState();
      } else if (document.visibilityState === 'hidden') {
        this.handleHiddenState();
      }
    });

    // Also check on touchstart for iOS safety
    document.addEventListener('touchstart', () => {
      if (document.visibilityState === 'visible') {
        this.handleVisibleState();
      }
    }, { passive: true });

    // Check status on load
    this.checkSleepStatus();

    // Try to sync any queued data
    this.syncData();

    // Listen for user-synced event to retry sync
    window.addEventListener('user-synced', () => {
      this.syncData();
      // Only load sleep status if sleep tab is active
      const viewSleep = document.getElementById('view-sleep');
      if (viewSleep && viewSleep.classList.contains('active')) {
        this.loadSleepStatus();
      }
    });

    // Listen for network recovery to sync queued data
    window.addEventListener('online', () => {
      console.log('[SleepTracker] Network recovered, syncing queued data...');
      this.syncData();
    });

    // Load sleep status when sleep tab is activated
    const sleepTabBtn = document.querySelector('[data-tab="sleep"]');
    if (sleepTabBtn) {
      sleepTabBtn.addEventListener('click', () => {
        // 이미 로드되었으면 재요청 방지
        if (this.sleepStatusLoaded) return;
        setTimeout(() => this.loadSleepStatus(), 100);
      });
    }
  }

  setupMascots() {
    const overlay = this.elements.overlay;
    if (!overlay) return;

    // 기존 moon icon 찾기
    const moonIcon = overlay.querySelector('.sleep-moon-icon');

    // 이미 교체되었는지 확인
    if (!moonIcon && overlay.querySelector('.sleep-mascot-container')) return;

    // 컨테이너 생성
    const container = document.createElement('div');
    container.className = 'sleep-mascot-container';

    // 자말라 (Center)
    const komalaUrl = getPokemonImageUrl('KOMALA', '', 'Front');
    const komalaDiv = document.createElement('div');
    komalaDiv.id = 'sleep-mascot-komala';
    komalaDiv.className = 'sleep-mascot';
    komalaDiv.style.setProperty('--scale-x', '1');

    // Zzz 효과
    const zzz = document.createElement('div');
    zzz.className = 'sleep-zzz';
    zzz.textContent = 'Zzz...';

    container.appendChild(zzz);
    container.appendChild(komalaDiv);

    if (moonIcon) {
      moonIcon.replaceWith(container);
    } else {
      const content = overlay.querySelector('.sleep-content');
      if (content) {
        content.prepend(container);
      }
    }

    // 스프라이트 애니메이션 초기화 (div가 DOM에 추가된 후 실행)
    setupSprite('sleep-mascot-komala', komalaUrl, 3);
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock active');
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
      console.log('Wake Lock released');
    }
  }

  startSleep() {
    // Check if already slept today
    if (this.sleepStatus && !this.sleepStatus.canSleepToday) {
      this.showMessage('이미 오늘은 수면을 기록했습니다.', 'warning');
      return;
    }

    // Step 1: Sleep Prep
    localStorage.setItem('sleepPrep', 'true');
    this.showOverlay(Date.now());
    this.requestWakeLock();
  }

  handleHiddenState() {
    // Step 2: Sleep Start
    if (localStorage.getItem('sleepPrep') === 'true') {
      const startTime = Date.now();
      const session = {
        status: 'sleeping',
        startTime: startTime
      };
      localStorage.setItem(this.storageKey, JSON.stringify(session));
      localStorage.removeItem('sleepPrep');
      console.log('Sleep started at', new Date(startTime).toLocaleTimeString());
    }

    // If already sleeping, cancel any wake-up timeout (user went back to sleep)
    if (this.wakeUpTimeout) {
      clearTimeout(this.wakeUpTimeout);
      this.wakeUpTimeout = null;
      console.log('Sleep resumed (screen off)');
    }
  }

  handleVisibleState() {
    // Step 4: Wake up - Strict mode: immediately check duration
    const sessionStr = localStorage.getItem(this.storageKey);
    if (!sessionStr) return;

    const session = JSON.parse(sessionStr);
    if (session.status === 'sleeping') {
      const now = Date.now();
      const duration = now - session.startTime;
      const MIN_SLEEP_DURATION = 4 * 60 * 60 * 1000; // 4 hours

      if (duration < MIN_SLEEP_DURATION) {
        // 4시간 미만: 즉시 수면 취소
        console.log('Sleep cancelled: duration less than 4 hours');
        localStorage.removeItem(this.storageKey);
        this.hideOverlay();
        this.releaseWakeLock();

        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        showToast(`수면 시간이 너무 짧아 기록되지 않았어요 (${hours}시간 ${minutes}분 / 최소 4시간)`);
        return;
      }

      // 4시간 이상: 오버레이 표시하고 바로 종료 처리
      this.showOverlay(session.startTime);
      this.finishSleep();
    }
  }

  finishSleep() {
    // 1. 세션 정보 확인
    const sessionStr = localStorage.getItem(this.storageKey);
    if (!sessionStr) {
      this.hideOverlay();
      this.releaseWakeLock();
      return;
    }

    const session = JSON.parse(sessionStr);
    const endTime = Date.now();
    const startTime = session.startTime;
    const duration = endTime - startTime;

    // 4 hours in ms = 14,400,000
    const MIN_SLEEP_DURATION = 14400000;

    // 2. 중요: 로컬 스토리지 세션 삭제 (가장 먼저 실행하여 상태 리셋 보장)
    localStorage.removeItem(this.storageKey);
    console.log('Sleep session cleared from localStorage');

    // 3. UI 및 리소스 정리
    this.hideOverlay();
    this.releaseWakeLock();
    if (this.wakeUpTimeout) {
      clearTimeout(this.wakeUpTimeout);
      this.wakeUpTimeout = null;
    }

    // 4. 수면 시간 검증 및 처리
    if (duration < MIN_SLEEP_DURATION) {
      showToast('수면 시간이 너무 짧아 기록되지 않았어요 (4시간 미만)');
      // 상태 리프레시 (서버는 "아직 안 잤음" 상태일 것이므로 UI가 "수면 가능"으로 돌아감)
      this.loadSleepStatus();
    } else {
      const sleepLog = {
        start: startTime,
        end: endTime,
        duration: duration
      };

      // 동기화 큐에 추가
      this.addToSyncQueue(sleepLog);

      const hours = Math.floor(duration / 3600000);
      const minutes = Math.floor((duration % 3600000) / 60000);

      // 서버 동기화 시도
      this.syncData().then((data) => {
        if (data && data.success) {
          const result = data.data;
          if (result.rewardedPokemon && result.rewardedPokemon.length > 0) {
            showToast(`✨ ${result.rewardedPokemon.length}마리의 이로치를 획득했습니다!`);
            this.showMessage(`${result.rewardedPokemon.map(p => p.name).join(', ')} 이로치 획득!`, 'success');

            if (typeof loadUserPokemonIcons === 'function') {
              loadUserPokemonIcons();
            }
          } else {
            showToast(`수면 시간 기록됨: ${hours}시간 ${minutes}분`);
          }
        } else {
          // 오프라인이거나 실패 시 로컬 메시지
          showToast(`수면 시간 기록됨: ${hours}시간 ${minutes}분 (동기화 대기)`);
        }
        // 동기화 후 최신 상태 로드 (서버의 "수면 완료" 상태 반영)
        this.loadSleepStatus();
      });
    }
  }

  // Legacy cancel method (optional, if we want a specific cancel button)
  cancelSleep() {
    this.finishSleep(); // Just map to finish for now
  }

  showOverlay(startTime) {
    if (this.elements.overlay) {
      this.elements.overlay.style.display = 'flex';
      void this.elements.overlay.offsetWidth;
      this.elements.overlay.classList.add('active');
    }

    this.updateTimer(startTime);
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.updateTimer(startTime), 1000);
  }

  hideOverlay() {
    if (this.elements.overlay) {
      this.elements.overlay.style.display = 'none';
      this.elements.overlay.classList.remove('active');
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimer(startTime) {
    if (!this.elements.timer) return;
    const diff = Date.now() - startTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    this.elements.timer.textContent =
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  checkSleepStatus() {
    // On load, check if we should show overlay AND validate duration
    const sessionStr = localStorage.getItem(this.storageKey);
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session.status === 'sleeping') {
        const now = Date.now();
        const duration = now - session.startTime;
        const MIN_SLEEP_DURATION = 4 * 60 * 60 * 1000; // 4 hours

        if (duration < MIN_SLEEP_DURATION) {
          // 4시간 미만: 즉시 수면 취소 (오버레이 표시하지 않음)
          console.log('Sleep cancelled on reload: duration less than 4 hours');
          localStorage.removeItem(this.storageKey);

          const hours = Math.floor(duration / 3600000);
          const minutes = Math.floor((duration % 3600000) / 60000);
          showToast(`수면 시간이 너무 짧아 기록되지 않았어요 (${hours}시간 ${minutes}분 / 최소 4시간)`);
        } else {
          // 4시간 이상: 오버레이 표시
          this.showOverlay(session.startTime);
        }
      }
    }
    // Remove anti-flicker class now that JS has taken over
    document.documentElement.classList.remove('sleep-mode-pending');
  }

  addToSyncQueue(log) {
    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem(this.queueKey) || '[]');
    } catch (e) {
      queue = [];
    }
    queue.push(log);
    localStorage.setItem(this.queueKey, JSON.stringify(queue));
  }

  async syncData() {
    if (!window.isAuthenticated()) return;

    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem(this.queueKey) || '[]');
    } catch (e) {
      return;
    }

    if (queue.length === 0) return;

    const userId = window.getCurrentUserId ? window.getCurrentUserId() : null;
    if (!userId) return;

    console.log(`Syncing ${queue.length} sleep logs...`);

    let lastResponseData = null;
    const newQueue = [];
    for (const log of queue) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/sleep', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            userId: userId,
            start: log.start,
            end: log.end,
            duration: log.duration
          })
        });

        if (!response.ok) {
          throw new Error('Sync failed');
        }
        lastResponseData = await response.json();
      } catch (err) {
        console.error('Sleep sync error:', err);
        newQueue.push(log);
        // Schedule retry after 3 seconds (handles WiFi reconnection delay)
        if (!this._retryScheduled) {
          this._retryScheduled = true;
          setTimeout(() => {
            this._retryScheduled = false;
            console.log('[SleepTracker] Retrying sync after 3s delay...');
            this.syncData();
          }, 3000);
        }
      }
    }

    localStorage.setItem(this.queueKey, JSON.stringify(newQueue));
    return lastResponseData;
  }

  // ==========================================
  // Sleep Reward UI Methods
  // ==========================================

  async loadSleepStatus() {
    const isGuest = window.isGuest();
    if (!window.isAuthenticated() && !isGuest) {
      this.renderGuestState();
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const apiEndpoint = isGuest ? '/api/guest/sleep-status' : '/api/sleep/status';
      const response = await fetch(apiEndpoint, { headers });

      if (!response.ok) {
        throw new Error('Failed to load sleep status');
      }

      const responseData = await response.json();
      if (responseData.success) {
        this.sleepStatus = responseData.data.sleepStatus;
        this.sleepStatusLoaded = true; // 로드 성공 표시
        this.renderSleepRewardUI(responseData);
      }
    } catch (err) {
      console.error('Failed to load sleep status:', err);
      this.showMessage('수면 상태를 불러오는데 실패했습니다.', 'error');
    }
  }

  renderGuestState() {

    if (this.elements.percentageText) {
      this.elements.percentageText.textContent = '--%';
    }
    if (this.elements.holidayRuleText) {
      this.elements.holidayRuleText.style.display = 'none';
    }

    if (this.elements.startBtn) {
      this.elements.startBtn.disabled = true;
    }
  }

  renderSleepRewardUI(responseData) {
    const { todayPokemon, sleepStatus } = responseData.data;
    const timestamp = responseData.timestamp;

    // 전역 변수에 sleepPokemonList 저장 (네비게이션용)
    sleepPokemonList = todayPokemon || [];

    // Determine which percentage to show
    const displayPercentage = sleepStatus.canSleepToday
      ? sleepStatus.expectedPercentage
      : sleepStatus.currentRewardPercentage;

    // Save data for resize rerendering
    this.lastRenderData = {
      pokemon: todayPokemon,
      percentage: displayPercentage,
      rewardTable: sleepStatus.rewardTable
    };

    // Update percentage text
    if (this.elements.percentageText) {
      this.elements.percentageText.textContent = `${Math.round(displayPercentage)}%`;
    }

    // Update Holiday Rule Visibility
    if (this.elements.holidayRuleText) {
      if (sleepStatus.isWakeUpDayOff) {
        this.elements.holidayRuleText.style.display = 'flex';
      } else {
        this.elements.holidayRuleText.style.display = 'none';
      }
    }

    // Update Sleep Time Prefix (Before 10 PM vs After 10 PM)
    if (this.elements.sleepTimePrefix) {
      const serverTime = timestamp ? new Date(timestamp) : new Date();
      const hour = serverTime.getHours();
      if (hour < 22) {
        this.elements.sleepTimePrefix.textContent = '일찍 자면';
      } else {
        this.elements.sleepTimePrefix.textContent = '지금 자면';
      }
    }

    // Progress bar logic removed (replaced by snake connectors)

    // Render Pokemon icons and Time Markers
    this.renderPokemonIcons(todayPokemon, displayPercentage, sleepStatus.rewardTable);

    // Update button states

    if (this.elements.startBtn) {
      this.elements.startBtn.disabled = !sleepStatus.canSleepToday;
    }

    this.hideMessage();
  }

  renderPokemonIcons(pokemon, percentage, rewardTable = null) {
    if (!this.elements.pokemonIcons) return;

    this.elements.pokemonIcons.innerHTML = '';

    if (!pokemon || pokemon.length === 0) {
      const noMsg = document.createElement('div');
      noMsg.className = 'no-pokemon-message';
      noMsg.innerHTML = `
        <p>오늘 획득한 포켓몬이 없습니다.<br>포켓몬을 획득하면 이로치 보상이 표시됩니다.</p>
      `;
      this.elements.pokemonIcons.appendChild(noMsg);
      return;
    }

    // 1. Define Markers from API data
    let markers = [];
    if (rewardTable) {
      markers = Object.entries(rewardTable).map(([hour, percent]) => ({
        label: hour.padStart(2, '0'),
        percent: percent,
        type: 'marker'
      }));
    }

    // 2. Assign percent to Pokemon
    const totalPokemon = pokemon.length;
    const pokemonWithPercent = pokemon.map((p, index) => ({
      ...p,
      percent: ((totalPokemon - index) / (totalPokemon + 1)) * 100,
      type: 'pokemon'
    }));

    // 3. Merge and Sort
    // Sort by percent descending.
    // If percents are equal (or very close), Markers should come BEFORE Pokemon
    let mergedList = [...pokemonWithPercent, ...markers];
    mergedList.sort((a, b) => {
      if (Math.abs(a.percent - b.percent) < 0.1) {
        return a.type === 'marker' ? -1 : 1;
      }
      return b.percent - a.percent;
    });

    // 4. Grid Setup
    const totalItems = mergedList.length;
    const cols = 4;
    const rows = Math.ceil(totalItems / cols);
    const cellWidth = 100 / cols;
    const cellHeightPx = 80; // Fixed height per row in pixels
    const totalHeightPx = Math.max(rows, 3) * cellHeightPx;

    // Set container height dynamically
    if (this.elements.pokemonIcons) {
      this.elements.pokemonIcons.style.height = `${totalHeightPx}px`;
    }

    let prevX = null;
    let prevY = null;
    let prevObtainable = true;

    // Store connector data for deferred rendering
    const connectorData = [];

    mergedList.forEach((item, index) => {
      const isObtainable = item.percent <= percentage;

      // Grid Coordinates
      const row = Math.floor(index / cols);
      let col = index % cols;
      if (row % 2 === 1) col = cols - 1 - col;

      const x = (col * cellWidth) + (cellWidth / 2);
      const y = (row * cellHeightPx) + (cellHeightPx / 2);

      if (item.type === 'pokemon') {
        // Render Pokemon
        const milestoneEl = document.createElement('div');
        milestoneEl.className = `sleep-milestone ${isObtainable ? 'obtainable' : 'missed'}`;
        milestoneEl.style.left = `${x}%`;
        milestoneEl.style.top = `${y}px`;
        milestoneEl.title = `${item.name} (필요 달성률: ${Math.round(item.percent)}%)`;

        // Icon Box
        const iconBox = document.createElement('div');
        iconBox.className = 'sleep-pokemon-icon';

        // 클릭 이벤트 추가 (항상 기본형 도감 표시)
        iconBox.style.cursor = 'pointer';
        iconBox.setAttribute('onclick', `showIconGroupDetail('${item.base_image_name || item.image_name}', '${item.stable_id}', false, 'sleep')`);

        // Use pokemon-sprite logic for half-split effect
        const loadAndSetupSprite = (url, isRetry = false) => {
          const img = new Image();
          img.onload = () => {
            const spriteDiv = document.createElement('div');
            spriteDiv.className = 'pokemon-sprite';
            spriteDiv.dataset.src = url;
            iconBox.innerHTML = ''; // Clear previous content
            iconBox.appendChild(spriteDiv);
            if (typeof setupPokemonSprite === 'function') {
              setupPokemonSprite(spriteDiv);
            }
          };
          img.onerror = () => {
            if (!isRetry) {
              const normalUrl = url.replace('Icons%20shiny', 'Icons');
              loadAndSetupSprite(normalUrl, true);
            }
          };
          img.src = url;
        };

        loadAndSetupSprite(item.icon_shiny_url);

        // Label
        const labelEl = document.createElement('div');
        labelEl.className = 'milestone-label';
        labelEl.textContent = `${Math.round(item.percent)}%`;

        milestoneEl.appendChild(iconBox);
        milestoneEl.appendChild(labelEl);
        this.elements.pokemonIcons.appendChild(milestoneEl);
      } else {
        // Render Marker
        const markerEl = document.createElement('div');
        markerEl.className = `time-marker-item ${isObtainable ? 'active' : ''}`;
        markerEl.style.left = `${x}%`;
        markerEl.style.top = `${y}px`;
        markerEl.textContent = item.label;
        markerEl.title = `${item.label}시 (${item.percent}%)`;

        this.elements.pokemonIcons.appendChild(markerEl);
      }

      // Store connector data instead of drawing immediately
      if (index > 0 && prevX !== null && prevY !== null) {
        connectorData.push({
          x1: prevX,
          y1: prevY,
          x2: x,
          y2: y,
          isActive: prevObtainable && isObtainable
        });
      }

      prevX = x;
      prevY = y;
      prevObtainable = isObtainable;
    });

    // Draw all connectors after DOM layout is complete
    requestAnimationFrame(() => {
      connectorData.forEach(data => {
        this.drawConnector(data.x1, data.y1, data.x2, data.y2, data.isActive);
      });
    });
  }

  drawConnector(x1, y1, x2, y2, isActive) {
    const connector = document.createElement('div');
    connector.className = `snake-connector ${isActive ? 'active' : ''}`;

    // Get container dimensions to convert % to px
    const container = this.elements.pokemonIcons;
    if (!container) return;

    const w = container.offsetWidth;

    // Safety check: if container width is 0, skip rendering
    if (w <= 0) {
      console.warn('Container width is 0, skipping connector rendering');
      return;
    }

    const px1 = (x1 / 100) * w;
    const py1 = y1; // Already in px
    const px2 = (x2 / 100) * w;
    const py2 = y2; // Already in px

    const length = Math.sqrt(Math.pow(px2 - px1, 2) + Math.pow(py2 - py1, 2));
    const angle = Math.atan2(py2 - py1, px2 - px1) * (180 / Math.PI);

    // Style
    connector.style.width = `${length}px`;
    connector.style.height = '6px'; // Thickness
    connector.style.left = `${x1}%`;
    connector.style.top = `${y1}px`;
    connector.style.transform = `rotate(${angle}deg)`;

    this.elements.pokemonIcons.prepend(connector); // Behind icons
  }

  handleResize() {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      if (this.lastRenderData) {
        this.renderPokemonIcons(
          this.lastRenderData.pokemon,
          this.lastRenderData.percentage,
          this.lastRenderData.rewardTable
        );
      }
    }, 200);
  }

  showMessage(text, type = 'info') {
    if (!this.elements.message) return;
    this.elements.message.textContent = text;
    this.elements.message.className = `sleep-message ${type}`;
  }

  hideMessage() {
    if (!this.elements.message) return;
    this.elements.message.className = 'sleep-message';
    this.elements.message.textContent = '';
  }
}

// Initialize Sleep Mode on Load
document.addEventListener('DOMContentLoaded', () => {
  window.sleepTracker = new SleepTracker();
});

// Initialize Pokemon filter modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initPokemonFilter === 'function') {
    try {
      initPokemonFilter();
    } catch (e) {
      console.error('initPokemonFilter 호출 중 오류:', e);
    }
  }
});


// ==========================================
// 서식지 시스템 (Habitat System)
// ==========================================

let currentHabitatData = {
  current_habitat: 'random',
  current_sub_habitat: null,
  can_change_habitat: true
};

// 서식지 초기화
async function initHabitat() {
  console.log('initHabitat called');
  const habitatIconBtn = document.getElementById('habitatIconBtn');
  const habitatCloseBtn = document.getElementById('habitat-close');

  // 탭 버튼
  const changeTab = document.getElementById('changeTab');
  const moveTab = document.getElementById('moveTab');
  const pokemonDisplayBackBtn = document.getElementById('pokemonDisplayBackBtn');

  console.log('habitatIconBtn:', habitatIconBtn);

  if (habitatIconBtn) {
    habitatIconBtn.addEventListener('click', openHabitatModal);
    console.log('habitatIconBtn click listener added');
  } else {
    console.error('habitatIconBtn not found!');
  }

  if (habitatCloseBtn) {
    habitatCloseBtn.addEventListener('click', closeHabitatModal);
  }

  // 탭 전환 이벤트
  if (changeTab) {
    changeTab.addEventListener('click', () => switchTab('change'));
  }

  if (moveTab) {
    moveTab.addEventListener('click', () => switchTab('move'));
  }

  if (pokemonDisplayBackBtn) {
    pokemonDisplayBackBtn.addEventListener('click', hidePokemonDisplay);
  }

  // 탭 변경 시 서식지 아이콘 표시/숨김 처리 (홈 탭에서만 표시)
  const tabButtons = document.querySelectorAll('.tab-item');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (habitatIconBtn) {
        habitatIconBtn.style.display = tabId === 'home' ? 'flex' : 'none';
      }
    });
  });

  // 초기 데이터 로드
  await fetchUserHabitat();
}

// 탭 전환 함수
function switchTab(tabName) {
  // 탭 버튼 활성화 상태 변경
  document.querySelectorAll('.habitat-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');

  // 탭 패널 표시/숨김
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = 'none';
  });
  document.getElementById(`${tabName}TabPane`).style.display = 'block';

  // 포켓몬 디스플레이 숨기기
  hidePokemonDisplay();

  // 탭에 따라 데이터 렌더링
  if (tabName === 'change') {
    renderMajorHabitatsGrid();
  } else if (tabName === 'move') {
    renderCurrentSubHabitats();
  }
}


// 사용자 서식지 정보 조회
async function fetchUserHabitat() {
  // 게스트 모드인 경우 기본 데이터 사용
  if (window.isGuestMode) {
    currentHabitatData = {
      current_habitat: 'random',
      current_sub_habitat: null,
      can_change_habitat: true
    };
    updateHabitatUI();
    return;
  }

  if (!currentUserId) return;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/user/habitat`, { headers });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        currentHabitatData = result.data;
        updateHabitatUI();
      }
    }
  } catch (error) {
    console.error('Failed to fetch user habitat:', error);
  }
}

// 서식지 UI 업데이트 (아이콘 등)
function updateHabitatUI() {
  const iconImg = document.getElementById('currentHabitatIcon');
  const label = document.getElementById('currentHabitatLabel');
  const placeholder = document.querySelector('.habitat-icon-placeholder');

  if (!iconImg || !label || !placeholder) return;

  const habitatNameMap = {
    'grassland': '초원', 'forest': '숲', 'watersedge': '물가', 'sea': '바다',
    'cave': '동굴', 'mountain': '산', 'roughterrain': '험지', 'urban': '도시',
    'random': '랜덤', 'rare': '희귀'
  };

  const habitatName = habitatNameMap[currentHabitatData.current_habitat] || '랜덤';
  label.textContent = habitatName;

  // 아이콘 이미지 설정
  if (currentHabitatData.current_habitat !== 'random') {
    // 실제 서식지의 경우 아이콘 이미지 표시
    const iconFilename = `${currentHabitatData.current_habitat}.png`;
    iconImg.src = `${ASSETS_BASE_URL}/custom/img/ui/${iconFilename}`;
    iconImg.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    // 랜덤의 경우 물음표 placeholder 표시
    placeholder.style.display = 'block';
    iconImg.style.display = 'none';
    placeholder.textContent = '?';
  }
}

// 서식지 모달 열기
async function openHabitatModal() {
  console.log('openHabitatModal called, isGuestMode:', window.isGuestMode);
  const modal = document.getElementById('habitat-modal');
  console.log('habitat-modal:', modal);
  if (!modal) {
    console.error('habitat-modal not found!');
    return;
  }

  modal.style.display = 'flex';
  onModalOpen();

  // 데이터 최신화 (캐시 초기화 포함)
  cachedHabitats = null;

  // 병렬로 데이터 로드 (유저 정보 + 서식지 목록)
  await Promise.all([
    fetchUserHabitat(),
    loadHabitatsList()
  ]);

  // 현재 위치 렌더링 (데이터 로드 후 실행)
  renderCurrentLocationCard();
  renderMoveCounter();

  // 포켓몬 디스플레이 숨기기
  hidePokemonDisplay();

  // 첫 번째 탭 활성화 (서식지 변경)
  switchTab('change');
}

// ... (renderMajorHabitatsGrid는 아래에서 수정) ...

// 서식지 변경 확인 및 요청
async function confirmMajorHabitatChange(habitatSlug, displayName) {
  // 게스트 모드에서는 기능 제한
  if (window.isGuestMode) {
    showToast('로그인하면 서식지를 변경할 수 있습니다!');
    return;
  }

  let message = `메인 구역 <strong>[${displayName}]</strong>(으)로 이동하시겠습니까?`;

  if (habitatSlug === 'rare') {
    // 희귀 서식지 잠금 체크 (다른 모든 서식지 100% 완료 여부)
    const otherHabitats = (cachedHabitats || []).filter(h => h.slug !== 'rare' && h.slug !== 'random');
    const isFullyCompleted = otherHabitats.length > 0 && otherHabitats.every(h => {
      const totalCollected = h.backgrounds.reduce((sum, bg) => sum + (bg.collected_count || 0), 0);
      const totalPokemon = h.backgrounds.reduce((sum, bg) => sum + (bg.total_count || 0), 0);
      return totalPokemon > 0 && totalCollected >= totalPokemon;
    });

    if (!isFullyCompleted) {
      showToast('모든 서식지의 포켓몬을 수집해야 이동가능합니다.');
      return;
    }
  }

  if (habitatSlug !== 'random') {
    if (!currentHabitatData.can_change_habitat) {
      // 이미 함수 진입 전에 체크하겠지만, 한 번 더 체크
    }

    if (habitatSlug === 'rare') {
      message = `전설의 <strong>[${displayName}]</strong>(으)로 이동하시겠습니까?<br><br><small style="color:#d97706">✨ 이곳에서는 아주 특별한 포켓몬들이 등장합니다.</small>`;
    }

    message += `<br><br><small style="color:#e74c3c">⚠️ 주의: 메인 구역 이동은 하루 1회만 가능하며, 내일 새벽 4시까지 다시 변경할 수 없습니다.</small>`;
  } else {
    message += `<br><br><small>랜덤 서식지에서는 모든 포켓몬을 만날 수 있지만, 특정 구역을 선택할 수 없습니다.</small>`;
  }

  const confirmed = await showConfirmModal('서식지 이동', message);

  if (confirmed) {
    requestHabitatChange(habitatSlug, null);
  }
}


// 서식지 모달 닫기
function closeHabitatModal() {
  const modal = document.getElementById('habitat-modal');
  if (modal) {
    modal.style.display = 'none';
    onModalClose();
  }
}

// 포켓몬 디스플레이 숨기기
function hidePokemonDisplay() {
  document.getElementById('habitatPokemonDisplay').style.display = 'none';
}

// 현재 위치 카드 렌더링
function renderCurrentLocationCard() {
  const container = document.getElementById('currentLocationCard');
  if (!container) return;

  const habitatNameMap = {
    'grassland': '초원', 'forest': '숲', 'watersedge': '물가', 'sea': '바다',
    'cave': '동굴', 'mountain': '산', 'roughterrain': '험지', 'urban': '도시',
    'random': '랜덤', 'rare': '희귀'
  };

  const name = habitatNameMap[currentHabitatData.current_habitat] || '랜덤';
  const slug = currentHabitatData.current_habitat;

  // 기본값 설정
  let subName = '모든 서브 구역 탐험 가능';
  let bgImage = '';

  // 서식지 정보 찾기
  const habitat = cachedHabitats?.find(h => h.slug === slug);

  if (habitat) {
    // 기본 배경 (첫 번째)
    bgImage = habitat.backgrounds[0]?.image || '';

    // 현재 세부 서식지가 선택되어 있다면 해당 정보 찾기
    if (currentHabitatData.current_sub_habitat) {
      const currentBg = habitat.backgrounds.find(b => `${slug}_${b.type}` === currentHabitatData.current_sub_habitat);
      if (currentBg) {
        subName = currentBg.display_name; // 예: "깊은 동굴 (얼음)"
        bgImage = currentBg.image;        // 해당 구역의 배경 이미지 사용
      }
    }
  }

  let html = '';

  if (slug === 'random') {
    // 랜덤 서식지 - 스플릿 이미지 생성
    const randomSlugs = ['cave', 'forest', 'sea', 'urban', 'grassland'];
    const selectedImages = [];
    randomSlugs.forEach(rs => {
      const found = (cachedHabitats || []).find(h => h.slug === rs);
      if (found && found.backgrounds.length > 0) {
        selectedImages.push(`${ASSETS_BASE_URL}/custom/img/background/${rs}/${found.backgrounds[0].image}`);
      }
    });

    let collageHtml = '';
    if (selectedImages.length >= 3) {
      const stripHtml = selectedImages.slice(0, 5).map(url =>
        `<div style="flex:1; background-image: url('${url}'); background-size: cover; background-position: center; border-right: 1px solid rgba(255,255,255,0.2);"></div>`
      ).join('');

      collageHtml = `
        <div style="display: flex; width: 100%; height: 200px; position: relative;">
          ${stripHtml}
          <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
            <img src="/custom/img/ui/flip.svg" class="flip-icon" alt="flip" style="width: 72px; height: 72px; filter: brightness(0) invert(1) drop-shadow(0 4px 12px rgba(0,0,0,0.6));">
          </div>
        </div>
      `;
    } else {
      collageHtml = `<div style="height: 200px; background: linear-gradient(135deg, rgba(255,154,158,0.8) 0%, rgba(254,207,239,0.8) 50%, rgba(255,209,255,0.8) 100%), #333; display: flex; align-items: center; justify-content: center;"><img src="/custom/img/ui/flip.svg" class="flip-icon" alt="flip" style="width: 72px; height: 72px; filter: brightness(0) invert(1) drop-shadow(2px 2px 4px rgba(0,0,0,0.3));"></div>`;
    }

    html = `
      ${collageHtml}
      <div class="habitat-card-info">
        <div class="habitat-card-name">${name}</div>
        <div class="habitat-card-desc">모든 포켓몬이 등장할 수 있는 모험 지역입니다</div>
      </div>
    `;
  } else {
    // 특정 서식지
    const bgUrl = bgImage ? `${ASSETS_BASE_URL}/custom/img/background/${slug}/${bgImage}` : '';

    // 낮은 개체수 경고 로직
    let warningHtml = '';
    if (currentHabitatData.current_sub_habitat) {
      const currentBg = habitat.backgrounds.find(b => `${slug}_${b.type}` === currentHabitatData.current_sub_habitat);
      if (currentBg && currentBg.total_count <= 3) {
        warningHtml = `<div class="habitat-warning" style="color: #e53e3e; font-size: 0.8rem; margin-top: 4px;">
             ⚠️ 획득 가능한 포켓몬이 적은 구역입니다 (최대 ${currentBg.collected_count}마리)
           </div>`;
        // 토스트로도 알림 (한 번만 뜨게 하려면 플래그가 필요하지만, 여기서는 렌더링 될 때마다 표시되지 않도록 주의)
        // 렌더링은 자주 일어나므로 토스트는 제외하고 카드 내에 표시
      }
    }

    html = `
      <img src="${bgUrl}" alt="${name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22%3E%3Crect fill=%22%23e2e8f0%22 width=%22400%22 height=%22200%22/%3E%3C/svg%3E'">
      <div class="habitat-card-info">
        <div class="habitat-card-name">${currentHabitatData.current_sub_habitat ? name : name + ' 랜덤'}</div>
        <div class="habitat-card-desc">${subName}</div>
        ${warningHtml}
      </div>
    `;
  }

  container.innerHTML = html;
}

// 이동 횟수 표시 렌더링
function renderMoveCounter() {
  const container = document.getElementById('moveCounter');
  if (!container) return;

  const canMove = currentHabitatData.can_change_habitat;
  const icon = canMove ? '🚀' : '✅';
  const text = canMove ? '오늘 이동 가능' : '금일 이동 완료';
  const className = canMove ? '' : 'used';

  container.innerHTML = `
    <span class="icon">${icon}</span>
    <span>${text}</span>
  `;
  container.className = `move-counter ${className}`;
}



// 현재 서식지의 세부 서식지들을 현재 서식지 정보 섹션에 표시
function renderCurrentSubHabitatsInDisplay() {
  const grid = document.getElementById('currentSubHabitatsGrid');
  if (!grid) return;

  const slug = currentHabitatData.current_habitat;
  const habitat = cachedHabitats?.find(h => h.slug === slug);

  if (!habitat) {
    grid.innerHTML = '<p class="empty-message">서식지 정보를 불러오는 중...</p>';
    return;
  }

  grid.innerHTML = '';

  // 배경 이미지(및 표시 이름) 기준으로 그룹화
  const groupedBackgrounds = {};
  habitat.backgrounds.forEach(bg => {
    const key = `${bg.display_name}|${bg.image}`;
    if (!groupedBackgrounds[key]) {
      groupedBackgrounds[key] = {
        display_name: bg.display_name,
        image: bg.image,
        variants: []
      };
    }
    groupedBackgrounds[key].variants.push(bg);
  });

  Object.values(groupedBackgrounds).forEach(group => {
    const bgUrl = `${ASSETS_BASE_URL}/custom/img/background/${slug}/${group.image}`;

    const card = document.createElement('div');
    card.className = 'habitat-card';
    card.innerHTML = `
      <img src="${bgUrl}" class="habitat-card-img" alt="${group.display_name}">
      <div class="habitat-card-overlay">
        <div class="habitat-name">${group.display_name}</div>
      </div>
    `;

    // 클릭 시 포켓몬 목록 표시
    card.onclick = () => showPokemonListForSubHabitat(group.display_name, group.variants);

    grid.appendChild(card);
  });
}

// 세부 서식지의 포켓몬 목록 표시
function showPokemonListForSubHabitat(displayName, variants) {
  const pokemonDisplay = document.getElementById('habitatPokemonDisplay');
  const nameEl = document.getElementById('selectedSubHabitatName');
  const statsEl = document.getElementById('habitatPokemonStats');
  const gridEl = document.getElementById('habitatPokemonGrid');

  nameEl.textContent = displayName;

  // TODO: API 호출하여 실제 포켓몬 데이터 가져오기
  // 지금은 UI만 표시
  statsEl.innerHTML = `<strong>이 구역의 포켓몬</strong><br><span style="font-size: 12px; color: #718096;">정보 준비 중...</span>`;
  gridEl.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary);">
      <p>포켓몬 데이터는 API 연동 후 표시됩니다.</p>
    </div>
    
    <div style="grid-column: 1 / -1; margin-top: 20px; text-align: center;">
      <button id="confirmMoveBtn" class="confirm-move-btn" style="
        background-color: var(--primary-color); 
        color: white; 
        border: none; 
        padding: 12px 24px; 
        border-radius: 12px; 
        font-weight: bold; 
        font-size: 1rem; 
        cursor: pointer; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: transform 0.2s;
      ">
        이 구역으로 이동
      </button>
    </div>
  `;

  const confirmBtn = document.getElementById('confirmMoveBtn');
  if (confirmBtn) {
    // variants가 있으면 첫 번째 배경의 type을 사용하여 habitat_type 식별
    // habitat는 currentHabitatData.current_habitat
    // subHabitatKey는 "habitat_type"

    const currentHabitat = currentHabitatData.current_habitat;
    if (variants && variants.length > 0) {
      const type = variants[0].type; // bug, ice, etc.
      const subHabitatKey = `${currentHabitat}_${type}`;

      confirmBtn.onclick = async () => {
        // requestInnerHabitatMove 호출 (이동 후 UI 갱신 최적화)
        // displayName (예: 숲 (벌레))
        await requestInnerHabitatMove(currentHabitat, subHabitatKey, displayName);
      };
    } else {
      confirmBtn.style.display = 'none';
    }
  }

  pokemonDisplay.style.display = 'block';
}


// 전체 서식지 목록 로드 및 렌더링
let cachedHabitats = null;
async function loadHabitatsList() {
  if (cachedHabitats) {
    renderHabitatsGrid(cachedHabitats);
    return;
  }

  // 게스트 모드에서는 API 호출 스킵하고 빈 배열 사용 (또는 기본 데이터 사용)
  if (window.isGuestMode) {
    cachedHabitats = [];
    renderHabitatsGrid(cachedHabitats);
    return;
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/habitats`, { headers });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        cachedHabitats = result.data || [];

        // 현재 모달이 열려있고, 서식지 변경 탭이 활성화된 경우 UI 갱신
        const changeTabPane = document.getElementById('changeTabPane');
        if (changeTabPane && changeTabPane.style.display !== 'none') {
          renderMajorHabitatsGrid();
        }
      }
    }
  } catch (error) {
    console.error('Failed to load habitats:', error);
  }
}



// 대분류 서식지 목록 렌더링 (서식지간 이동)
function renderMajorHabitatsGrid() {
  const grid = document.getElementById('majorHabitatGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const habitatNameMap = {
    'grassland': '초원', 'forest': '숲', 'watersedge': '물가', 'sea': '바다',
    'cave': '동굴', 'mountain': '산', 'roughterrain': '험지', 'urban': '도시',
    'random': '랜덤', 'rare': '희귀'
  };

  // 랜덤 옵션 추가
  // 랜덤 옵션 추가
  const randomCard = document.createElement('div');
  randomCard.className = 'habitat-card';

  // 스플릿 이미지 생성 (Vertical Strips)
  let randomImagesHtml = '';
  const randomSlugs = ['cave', 'forest', 'sea', 'urban', 'grassland'];
  const pool = cachedHabitats || [];

  // pool에서 랜덤하게 4개 정도 뽑거나, 고정된 순서로 가져옴
  const selectedImages = [];
  randomSlugs.forEach(slug => {
    const found = pool.find(h => h.slug === slug);
    if (found && found.backgrounds.length > 0) {
      selectedImages.push(`${ASSETS_BASE_URL}/custom/img/background/${slug}/${found.backgrounds[0].image}`);
    }
  });

  // 이미지가 3개 이상 모였을 때만 스플릿 뷰 적용
  if (selectedImages.length >= 3) {
    const stripHtml = selectedImages.slice(0, 5).map(url =>
      `<div style="flex:1; background-image: url('${url}'); background-size: cover; background-position: center; border-right: 1px solid rgba(255,255,255,0.2);"></div>`
    ).join('');

    randomImagesHtml = `
      <div style="display: flex; width: 100%; height: 100px; position: relative;">
        ${stripHtml}
        <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
          <img src="/custom/img/ui/flip.svg" class="flip-icon" alt="flip" style="width: 32px; height: 32px; filter: brightness(0) invert(1) drop-shadow(0 2px 8px rgba(0,0,0,0.6));">
        </div>
      </div>
    `;
  } else {
    // Fallback gradient
    randomImagesHtml = `<div style="height: 100px; background: linear-gradient(135deg, rgba(255,154,158,0.8) 0%, rgba(254,207,239,0.8) 50%, rgba(255,209,255,0.8) 100%), #333; display: flex; align-items: center; justify-content: center;"><img src="/custom/img/ui/flip.svg" class="flip-icon" alt="flip" style="width: 32px; height: 32px; filter: brightness(0) invert(1) drop-shadow(2px 2px 4px rgba(0,0,0,0.3));"></div>`;
  }

  // 수집률 계산 (랜덤용 전체 통계)
  let totalAllCollected = 0;
  let totalAllPokemon = 0;
  let isRareUnlocked = false;

  if (cachedHabitats) {
    const otherHabitats = cachedHabitats.filter(h => h.slug !== 'rare' && h.slug !== 'random');

    // 전체 통계 계산
    cachedHabitats.forEach(habitat => {
      totalAllCollected += habitat.backgrounds.reduce((sum, bg) => sum + (bg.collected_count || 0), 0);
      totalAllPokemon += habitat.backgrounds.reduce((sum, bg) => sum + (bg.total_count || 0), 0);
    });

    // 희귀 서식지 해금 여부 확인
    isRareUnlocked = otherHabitats.length > 0 && otherHabitats.every(h => {
      const tc = h.backgrounds.reduce((sum, bg) => sum + (bg.collected_count || 0), 0);
      const tp = h.backgrounds.reduce((sum, bg) => sum + (bg.total_count || 0), 0);
      return tp > 0 && tc >= tp;
    });
  }

  randomCard.innerHTML = `
    ${randomImagesHtml}
    <div class="habitat-card-info">
      <div class="habitat-card-name">전체 랜덤</div>
      <div class="habitat-card-type" style="font-size: 11px; color: #888;">
        전체: (${totalAllCollected}/${totalAllPokemon})
      </div>
    </div>
  `;
  randomCard.onclick = () => confirmMajorHabitatChange('random', '랜덤');
  grid.appendChild(randomCard);

  // 실제 서식지들 (Backend에서 이미 total_count 기준으로 정렬되어 옴)
  if (cachedHabitats) {
    // 희귀 서식지를 항상 마지막에 배치
    const sortedHabitats = [...cachedHabitats].sort((a, b) => {
      if (a.slug === 'rare') return 1;
      if (b.slug === 'rare') return -1;
      return 0; // 나머지는 기존 순서(백엔드 정렬) 유지
    });

    sortedHabitats.forEach(habitat => {
      const slug = habitat.slug;
      if (!slug || slug === 'random') return; // 방어 코드
      if (!habitat) return;

      const bgImage = habitat.backgrounds[0]?.image || '';
      const bgUrl = bgImage ? `${ASSETS_BASE_URL}/custom/img/background/${slug}/${bgImage}` : '';
      const name = habitatNameMap[slug] || habitat.name;

      // 수집률 계산
      const totalCollected = habitat.backgrounds.reduce((sum, bg) => sum + (bg.collected_count || 0), 0);
      const totalPokemon = habitat.backgrounds.reduce((sum, bg) => sum + (bg.total_count || 0), 0);
      const isCompleted = totalPokemon > 0 && totalCollected >= totalPokemon;
      const progressPercent = totalPokemon > 0 ? Math.round((totalCollected / totalPokemon) * 100) : 0;

      const card = document.createElement('div');
      card.className = 'habitat-card';
      if (isCompleted) card.classList.add('completed-habitat'); // CSS 스타일링용 클래스

      let collectionStatusHtml = '';
      if (totalPokemon === 0) {
        collectionStatusHtml = '<span style="color: #aaa;">발견된 포켓몬 없음</span>';
      } else if (isCompleted) {
        collectionStatusHtml = '<span style="color: #d97706; font-weight: bold;">🎉 수집 완료!</span>';
      } else {
        collectionStatusHtml = `수집률: ${progressPercent}% (${totalCollected}/${totalPokemon})`;
      }

      // 희귀 서식지 잠금 상태 처리
      const isLockedRare = slug === 'rare' && !isRareUnlocked;

      card.innerHTML = `
      <img src="${bgUrl}" class="habitat-card-img" alt="${name}" style="${isLockedRare ? 'filter: grayscale(1) brightness(0.7);' : ''}">
      ${isCompleted ? '<div class="habitat-completed-badge" style="background: rgba(255, 215, 0, 0.9); color: #744210; font-weight: bold; padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">👑 졸업</div>' : ''}
      ${isLockedRare ? '<div class="habitat-lock-overlay" style="position: absolute; top:0; left:0; width:100%; height:100px; display: flex; align-items: center; justify-content: center; font-size: 30px; color: white; text-shadow: 0 0 10px rgba(0,0,0,0.8);">🔒</div>' : ''}
      <div class="habitat-card-info" style="${isLockedRare ? 'opacity: 0.6;' : ''}">
        <div class="habitat-card-name">${name}</div>
        <div class="habitat-card-type" style="font-size: 11px; color: #666;">
          ${isLockedRare ? '<span style="color: #e53e3e;">🔒 모두 수집 필요</span>' : collectionStatusHtml}
        </div>
      </div>
    `;

      // TODO: 포켓몬 수집 여부에 따른 disabled 처리
      // 지금은 일단 모두 활성화
      const isAvailable = true; // await checkHabitatAvailability(slug);

      if (!isAvailable || isLockedRare) {
        card.classList.add('disabled');
        if (isLockedRare) {
          card.onclick = () => showToast('모든 서식지의 포켓몬을 수집해야 이동가능합니다.');
        }
      }

      if (isAvailable) {
        card.onclick = async () => {
          if (isCompleted) {
            const confirmed = await showConfirmModal(
              '졸업 서식지 알림',
              `<strong>[${name}]</strong> 서식지의 모든 포켓몬을 이미 획득했습니다! (졸업)<br><br>그래도 이동하시겠습니까?<br><small style="color: #666">(이동 시 보상으로 다른 서식지의 포켓몬이 등장할 수 있습니다)</small>`
            );
            if (!confirmed) return;
          }
          confirmMajorHabitatChange(slug, name);
        };
      }

      grid.appendChild(card);
    });
  }
}

// 현재 서식지의 세부 서식지 목록 렌더링 (서식지 내 이동)
function renderCurrentSubHabitats() {
  const grid = document.getElementById('subHabitatGrid');
  if (!grid) return;

  const slug = currentHabitatData.current_habitat;

  if (slug === 'random') {
    grid.innerHTML = '<p class="empty-message" style="grid-column: 1 / -1; text-align: center; padding: 40px;">랜덤 서식지는 세부 구역이 없습니다<br><span style="font-size:12px; color:#888;">(모든 포켓몬이 랜덤하게 등장합니다)</span></p>';
    return;
  }

  const habitat = cachedHabitats?.find(h => h.slug === slug);

  if (!habitat) {
    grid.innerHTML = '<p class="empty-message">서식지 정보를 불러올 수 없습니다.</p>';
    return;
  }

  grid.innerHTML = '';

  // 배경 이미지 기준으로 그룹화
  const groupedBackgrounds = {};
  habitat.backgrounds.forEach(bg => {
    const key = `${bg.display_name}|${bg.image}`;
    if (!groupedBackgrounds[key]) {
      groupedBackgrounds[key] = {
        display_name: bg.display_name,
        image: bg.image,
        variants: []
      };
    }
    groupedBackgrounds[key].variants.push(bg);
  });

  Object.values(groupedBackgrounds).forEach(group => {
    const bgUrl = `${ASSETS_BASE_URL}/custom/img/background/${slug}/${group.image}`;

    // 수집률 계산 (그룹 내 합산)
    const groupCollected = group.variants.reduce((sum, v) => sum + (v.collected_count || 0), 0);
    const groupTotal = group.variants.reduce((sum, v) => sum + (v.total_count || 0), 0);
    const isCompleted = groupTotal > 0 && groupCollected >= groupTotal;

    // 타입 아이콘 생성
    const typesHtml = group.variants.map(v =>
      `<img src="${ASSETS_BASE_URL}/custom/img/ui/${v.type}.png" alt="${getKoreanType(v.type)}" class="type-icon" title="${getKoreanType(v.type)}">`
    ).join('');

    const card = document.createElement('div');
    card.className = 'habitat-card';
    if (isCompleted) {
      // card.style.opacity = '0.7'; // 졸업한 구역은 반투명 처리 (선택사항)
      // card.title = "졸업한 구역입니다";
    }

    card.innerHTML = `
      <img src="${bgUrl}" class="habitat-card-img" alt="${group.display_name}">
      ${isCompleted ? '<div class="habitat-completed-badge">👑 졸업</div>' : ''}
      <div class="habitat-card-info">
        <div class="habitat-card-name">${group.display_name}</div>
        <div class="habitat-card-types">
          ${typesHtml}
        </div>
        <div class="habitat-card-collection">
          <span class="collection-count" style="${isCompleted ? 'color: #ffd700; fontWeight: bold;' : ''}">
            ${groupCollected}/${groupTotal} ${isCompleted ? '(완료)' : ''}
          </span>
         
        </div>
      </div>
    `;

    // 클릭 이벤트: 구역 이동 (무제한)
    card.onclick = async () => {
      const currentHabitat = currentHabitatData.current_habitat;
      const type = group.variants[0].type;
      const subHabitatKey = `${currentHabitat}_${type}`;

      const confirmed = await showConfirmModal('구역 이동', `<strong>[${group.display_name}]</strong> 구역으로 이동하시겠습니까?`);
      if (confirmed) {
        await requestInnerHabitatMove(currentHabitat, subHabitatKey, group.display_name);
      }
    };

    grid.appendChild(card);
  });
}


// 세부 서식지 내 이동 요청 (무제한)
async function requestInnerHabitatMove(habitat, subHabitat, displayName) {
  // 게스트 모드
  if (window.isGuestMode) {
    showToast('로그인하면 서식지를 변경할 수 있습니다!');
    return;
  }

  try {
    showGlobalLoading('이동 중...');
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/user/habitat`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitat, subHabitat, innerMove: true })
    });

    const result = await response.json();
    hideGlobalLoading();

    if (response.ok && result.success) {
      showToast('이동하였습니다.');
      if (result.data) {
        currentHabitatData.current_sub_habitat = result.data.current_sub_habitat;
        // fetchUserHabitat()를 호출하여 전체 상태를 동기화하는 것이 가장 안전함
        await fetchUserHabitat();
      }

      // UI 업데이트
      updateHabitatUI();
      renderCurrentLocationCard();

      // 필요하다면 모달 내 뷰를 갱신하거나 닫기할 수 있음
      // 여기서는 토스트만 띄우고 유지 (사용자가 계속 탐색할 수 있도록)
    } else {
      showToast(result.message || '이동에 실패했습니다.');
    }
  } catch (error) {
    hideGlobalLoading();
    console.error('Inner habitat move error:', error);
    showToast('이동 중 오류가 발생했습니다.');
  }
}


async function requestHabitatChange(habitat, subHabitat) {
  try {
    showGlobalLoading('서식지 이동 중...');
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/user/habitat`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitat, subHabitat })
    });

    const result = await response.json();
    hideGlobalLoading();

    if (response.ok && result.success) {
      showToast(result.data.message || '서식지가 변경되었습니다.');
      // 데이터 재요청 (요청사항 반영)
      await fetchUserHabitat();

      // UI 업데이트
      updateHabitatUI();
      renderCurrentLocationCard();
      renderMoveCounter();

      if (typeof showHabitatMainView === 'function') {
        showHabitatMainView(); // 메인 뷰로 복귀
      }

    } else {
      showToast(result.message || '서식지 이동에 실패했습니다.'); // error toast
    }
  } catch (error) {
    hideGlobalLoading();
    console.error('Habitat change error:', error);
    showToast('서식지 이동 중 오류가 발생했습니다.');
  }
}

// 서식지 포켓몬 목록 로드 (표시용)
async function loadHabitatPokemonList(habitatSlug) {
  const listContainer = document.getElementById('habitatPokemonList');
  if (!listContainer) return;

  if (habitatSlug === 'random') {
    listContainer.innerHTML = '<p class="info-text" style="text-align:center; padding:20px;">모든 포켓몬이 등장할 수 있습니다!</p>';
    return;
  }

  listContainer.innerHTML = '<div class="loading-spinner"></div>';

  listContainer.innerHTML = `
    <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
      <p>이 서식지에서 발견 가능한 포켓몬 목록은<br>아직 준비 중입니다.</p>
    </div>
  `;
}

// 전역 노출
window.openHabitatModal = openHabitatModal;
window.closeHabitatModal = closeHabitatModal;


/* ==========================================
   보상 획득 결과 모달 로직
   ========================================== */
function showRewardResultModal(rewards, comparisonResult = null, eventName = null) {
  const modal = document.getElementById('reward-result-modal');
  const modalBody = modal.querySelector('.reward-modal-body');
  const confirmBtn = document.getElementById('reward-confirm-btn');

  if (!modal || !modalBody) return;

  // 모달 바디 초기화
  modalBody.innerHTML = '';

  // obtained_reason 기반으로 등급 스타일 결정하는 헬퍼 함수
  const getGradeClass = (reason) => {
    if (!reason) return 'grade-s';
    const r = reason.toLowerCase();
    if (r.includes('환상')) return 'grade-ex';
    if (r.includes('전설')) return 'grade-sss';
    if (r.includes('울트라') || r.includes('패러독스')) return 'grade-ss';
    return 'grade-s';
  };

  // 포켓몬을 기본 보상과 이벤트 보상으로 분류
  const basePokemon = [];  // 스크린타임 기록 보상
  const eventPokemon = []; // 공휴일, 절기, 포켓몬 데이, 토요일 등

  if (rewards.pokemons && rewards.pokemons.length > 0) {
    rewards.pokemons.forEach(p => {
      const reason = p.obtained_reason || '';
      // 이벤트 보상 키워드 체크
      if (reason.includes('공휴일') || reason.includes('절기') || reason.includes('포켓몬 데이') || reason.includes('토요일')) {
        eventPokemon.push(p);
      } else {
        basePokemon.push(p);
      }
    });

    // 등급 우선순위 정렬 (EX -> SSS -> SS -> S)
    const gradePriority = {
      'grade-ex': 4,
      'grade-sss': 3,
      'grade-ss': 2,
      'grade-s': 1
    };

    const sortPokemonByGrade = (a, b) => {
      const gradeA = getGradeClass(a.obtained_reason);
      const gradeB = getGradeClass(b.obtained_reason);
      return (gradePriority[gradeB] || 1) - (gradePriority[gradeA] || 1);
    };

    basePokemon.sort(sortPokemonByGrade);
    eventPokemon.sort(sortPokemonByGrade);
  }

  let hasContent = false;

  // 통합 카드 섹션 생성
  const mainSection = document.createElement('div');
  mainSection.className = 'reward-category-section';
  // ===== 1. 이벤트 보상 섹션 =====
  if (eventPokemon.length > 0) {
    hasContent = true;

    // 이벤트 헤더
    let eventHeaderHtml = `
      <div class="reward-category-header event">
        <span class="reward-category-icon">🎉</span>
        <span class="reward-category-title">이벤트 보상</span>
      </div>
    `;
    if (eventName) {
      eventHeaderHtml += `<div class="reward-event-name">오늘은 "${eventName}"입니다!</div>`;
    }

    const headerWrapper = document.createElement('div');
    headerWrapper.innerHTML = eventHeaderHtml;
    while (headerWrapper.firstChild) mainSection.appendChild(headerWrapper.firstChild);

    // 이벤트 포켓몬 그리드
    const grid = document.createElement('div');
    grid.className = 'reward-grid-display';

    eventPokemon.forEach(p => {
      const gradeClass = getGradeClass(p.obtained_reason);
      const card = document.createElement('div');
      card.className = `reward-card ${gradeClass}`;
      const assetFolder = (p.asset_source === 'external' || p.asset_source === 'custom') ? 'custom' : 'base';
      const imgSrc = `${ASSETS_BASE_URL}/${assetFolder}/img/Icons/${p.image_name || p.stable_id}.png`;

      let badgeHtml = '';
      const reason = (p.obtained_reason || '').toLowerCase();
      if (reason.includes('환상')) badgeHtml = '<div class="reward-grade-badge mythical">환상</div>';
      else if (reason.includes('전설')) badgeHtml = '<div class="reward-grade-badge legendary">전설</div>';
      else if (reason.includes('울트라') || reason.includes('패러독스')) badgeHtml = '<div class="reward-grade-badge ultrabeast">울/패</div>';
      else {
        let eventLabel = '이벤트';
        if (reason.includes('공휴일')) eventLabel = '공휴일';
        else if (reason.includes('절기')) eventLabel = '24절기';
        else if (reason.includes('포켓몬 데이')) eventLabel = '포켓몬 데이';
        else if (reason.includes('토요일')) eventLabel = '토요일';
        badgeHtml = `<div class="reward-event-badge">${eventLabel}</div>`;
      }

      card.innerHTML = `
        ${badgeHtml}
        <div class="reward-img-container">
          <img src="${imgSrc}" class="reward-img reward-pokemon-img" onerror="this.src='${ASSETS_BASE_URL}/base/img/Eggs/000.png'">
        </div>
        <div class="reward-name">${p.name}</div>
      `;
      grid.appendChild(card);
    });

    mainSection.appendChild(grid);
  }
  // ===== 1. 스크린타임 보상 섹션 (기본 + 아이템) =====
  if (basePokemon.length > 0 || (rewards.items && rewards.items.length > 0)) {
    hasContent = true;

    // 헤더
    let headerHtml = `
      <div class="reward-category-header">
        <span class="reward-category-icon">📱</span>
        <span class="reward-category-title">스크린타임 보상</span>
      </div>
    `;

    // 비교 결과 텍스트
    if (comparisonResult) {
      headerHtml += `<div class="reward-comparison-text">${comparisonResult}</div>`;
    }

    const headerWrapper = document.createElement('div');
    headerWrapper.innerHTML = headerHtml;
    while (headerWrapper.firstChild) mainSection.appendChild(headerWrapper.firstChild);

    // 1-1. 새로운 포켓몬 (스크린타임)
    if (basePokemon.length > 0) {
      const pokemonSubSection = document.createElement('div');
      pokemonSubSection.className = 'reward-subsection';
      pokemonSubSection.innerHTML = `<div class="reward-subsection-title">새로운 포켓몬</div>`;

      const grid = document.createElement('div');
      grid.className = 'reward-grid-display';

      basePokemon.forEach(p => {
        const gradeClass = getGradeClass(p.obtained_reason);
        const card = document.createElement('div');
        card.className = `reward-card ${gradeClass}`;
        const assetFolder = (p.asset_source === 'external' || p.asset_source === 'custom') ? 'custom' : 'base';
        const imgSrc = `${ASSETS_BASE_URL}/${assetFolder}/img/Icons/${p.image_name || p.stable_id}.png`;

        let badgeHtml = '';
        const reason = (p.obtained_reason || '').toLowerCase();
        if (reason.includes('환상')) badgeHtml = '<div class="reward-grade-badge mythical">환상</div>';
        else if (reason.includes('전설')) badgeHtml = '<div class="reward-grade-badge legendary">전설</div>';
        else if (reason.includes('울트라')) badgeHtml = '<div class="reward-grade-badge ultrabeast">울트라</div>';
        else if (reason.includes('패러독스')) badgeHtml = '<div class="reward-grade-badge paradox">패러독스</div>';

        card.innerHTML = `
          ${badgeHtml}
          <div class="reward-img-container">
            <img src="${imgSrc}" class="reward-img reward-pokemon-img" onerror="this.src='${ASSETS_BASE_URL}/base/img/Eggs/000.png'">
          </div>
          <div class="reward-name">${p.name}</div>
        `;
        grid.appendChild(card);
      });

      pokemonSubSection.appendChild(grid);
      mainSection.appendChild(pokemonSubSection);
    }

    // 1-2. 아이템
    if (rewards.items && rewards.items.length > 0) {
      const itemSubSection = document.createElement('div');
      itemSubSection.className = 'reward-subsection';
      itemSubSection.innerHTML = `<div class="reward-subsection-title">아이템</div>`;

      const grid = document.createElement('div');
      grid.className = 'reward-grid-display';

      const itemImageMap = {
        'Mystic Charm': 'MYSTICCHARM',
        'Rare Candy': 'RARECANDY',
        'Oval Charm': 'OVALCHARM',
        'Shiny Charm': 'SHINYCHARM',
        'Brilliance Charm': 'BRILLIANCECHARM'
      };

      rewards.items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'reward-card';
        const imgName = itemImageMap[item.name] || 'RARECANDY';
        const imgSrc = `${ASSETS_BASE_URL}/custom/img/items/${imgName}.webp`;
        card.innerHTML = `
          <div class="reward-count-badge">${item.count}</div>
          <div class="reward-img-container">
            <img src="${imgSrc}" class="reward-img" onerror="this.style.display='none'">
          </div>
          <div class="reward-name">${item.nameKr || item.name}</div>
        `;
        grid.appendChild(card);
      });

      itemSubSection.appendChild(grid);
      mainSection.appendChild(itemSubSection);
    }
  }



  // 보상이 없는 경우
  if (!hasContent) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'reward-empty-message';
    emptyMsg.innerHTML = '이번엔 보상이 없네요.<br>다음 기회에 도전해보세요!';
    modalBody.appendChild(emptyMsg);
  } else {
    modalBody.appendChild(mainSection);
  }

  // 모달 표시
  modal.style.display = 'flex';
  if (typeof onModalOpen === 'function') onModalOpen();

  // 확인 버튼 이벤트
  confirmBtn.onclick = () => {
    modal.style.display = 'none';
    if (typeof onModalClose === 'function') onModalClose();

    // 아이템/포켓몬 목록 갱신 트리거
    if (typeof loadUserPokemonIcons === 'function') loadUserPokemonIcons();
    if (typeof loadHomeFavoritePokemon === 'function') loadHomeFavoritePokemon();
  };
}

// 전역 노출
window.showRewardResultModal = showRewardResultModal;


// ==========================================
// 미션 상태 시스템 (Mission Status System)
// ==========================================

let weeklyVerificationData = null;
let isWeeklyVerificationRequired = false;
let needsYesterdayScreenTime = false;
let yesterdayDate = null;
let isTodayScreenTimeCompleted = false;

/**
 * 앱 시작 시 미션 상태 확인 (주간 검증 + 어제 스크린타임 입력)
 */
async function checkMissionStatus() {
  // 게스트 모드에서는 검증 불필요
  if (window.isGuest() || !window.isAuthenticated()) {
    return;
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/screen-time/status', { headers });

    if (!response.ok) {
      console.error('Failed to check mission status');
      return;
    }

    const result = await response.json();

    if (result.success) {
      const data = result.data;

      // 주간 검증 필요 여부 처리
      if (data.needsVerification) {
        weeklyVerificationData = data;
        isWeeklyVerificationRequired = true;
      } else {
        isWeeklyVerificationRequired = false;
        weeklyVerificationData = null;
      }

      // 어제 스크린타임 입력 필요 여부 처리
      needsYesterdayScreenTime = data.needsYesterdayScreenTime || false;
      yesterdayDate = data.yesterdayDate || null;

      // 미션 카드 상태 업데이트
      if (typeof updateHomeMissionCards === 'function') updateHomeMissionCards();
    }
  } catch (error) {
    console.error('Mission status check error:', error);
  }
}

// 호환성을 위해 기존 함수명도 유지
const checkWeeklyVerificationStatus = checkMissionStatus;

/**
 * 주간 검증 모달 표시
 */
function showWeeklyVerificationModal() {
  const modal = document.getElementById('weekly-verification-modal');
  if (!modal) return;

  // 경고 상태 표시
  const warningStatusEl = document.getElementById('warning-status');
  const warningCountEl = document.getElementById('warning-count-display');
  const warningMessageEl = document.getElementById('warning-message');

  if (weeklyVerificationData.warningCount > 0) {
    if (warningStatusEl) warningStatusEl.style.display = 'flex';
    if (warningCountEl) warningCountEl.textContent = weeklyVerificationData.warningCount;

    if (warningMessageEl) {
      if (weeklyVerificationData.warningCount === 1) {
        warningMessageEl.textContent = '입력값과 기록값의 차이가 10% 이상입니다.';
      } else if (weeklyVerificationData.warningCount === 2) {
        warningMessageEl.innerHTML = '<strong style="color: #e53e3e;">한 번 더 오입력 시 포켓몬이 모두 삭제됩니다!</strong>';
      }
    }
  } else {
    if (warningStatusEl) warningStatusEl.style.display = 'none';
  }

  // 체크박스 초기화
  const over10Checkbox = document.getElementById('weeklyIsOver10Hours');
  if (over10Checkbox) {
    over10Checkbox.checked = false;
  }

  // 모달 표시
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  onModalOpen();

  // 입력 필드 초기화 및 이벤트 리스너 설정
  setupWeeklyVerificationInputs();
}

/**
 * 주간 검증 모달 닫기
 */
function closeWeeklyVerificationModal() {
  const modal = document.getElementById('weekly-verification-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
  }
}
window.closeWeeklyVerificationModal = closeWeeklyVerificationModal;


/**
 * 주간 검증 입력 필드 설정
 */
function setupWeeklyVerificationInputs() {
  const digit1 = document.getElementById('weeklyDigit1');
  const digit2 = document.getElementById('weeklyDigit2');
  const digit3 = document.getElementById('weeklyDigit3');
  const digit4 = document.getElementById('weeklyDigit4');
  const preview = document.getElementById('weeklyVerificationPreview');
  const submitBtn = document.getElementById('weekly-verification-submit-btn');
  const over10Checkbox = document.getElementById('weeklyIsOver10Hours');

  const digits = [digit1, digit2, digit3, digit4];

  // 입력 필드 초기화
  digits.forEach(input => {
    if (input) {
      input.value = '';
      // Remove old listeners to prevent duplicates
      const newEl = input.cloneNode(true);
      input.parentNode.replaceChild(newEl, input);
    }
  });

  // Re-select inputs after replacement (cloneNode)
  const newDigit1 = document.getElementById('weeklyDigit1');
  const newDigit2 = document.getElementById('weeklyDigit2');
  const newDigit3 = document.getElementById('weeklyDigit3');
  const newDigit4 = document.getElementById('weeklyDigit4');
  const newDigits = [newDigit1, newDigit2, newDigit3, newDigit4];

  newDigits.forEach(input => {
    if (input) {
      input.addEventListener('input', handleDigitInput);
      input.addEventListener('keydown', handleDigitKeydown);
    }
  });

  if (over10Checkbox) {
    // Remove old listener
    const newCheckbox = over10Checkbox.cloneNode(true);
    over10Checkbox.parentNode.replaceChild(newCheckbox, over10Checkbox);
    newCheckbox.addEventListener('change', updatePreviewAndButton);
  }

  // 제출 버튼 리스너 (기존 리스너 제거 위해 재설정)
  if (submitBtn) {
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    newSubmitBtn.addEventListener('click', handleSubmit);
  }

  function handleDigitInput(e) {
    const input = e.target;
    // 숫자만 허용
    const val = input.value.replace(/[^0-9]/g, '');
    input.value = val;

    if (val.length >= 1) {
      const nextInput = input.nextElementSibling;
      if (nextInput && nextInput.classList.contains('screen-time-digit')) {
        nextInput.focus();
      }
    }

    updatePreviewAndButton();
  }

  function handleDigitKeydown(e) {
    if (e.key === 'Backspace' && e.target.value === '') {
      const prevInput = e.target.previousElementSibling;
      if (prevInput && prevInput.classList.contains('screen-time-digit')) {
        prevInput.focus();
      }
    }
  }

  // 값을 가져오고 파싱하여 미리보기 및 버튼 상태 업데이트
  function updatePreviewAndButton() {
    const d1 = document.getElementById('weeklyDigit1').value || '';
    const d2 = document.getElementById('weeklyDigit2').value || '';
    const d3 = document.getElementById('weeklyDigit3').value || '';
    const d4 = document.getElementById('weeklyDigit4').value || '';

    const codeStr = d1 + d2 + d3 + d4;

    if (codeStr.length === 0) {
      if (preview) preview.textContent = '-';
      toggleSubmitBtn(false);
      return;
    }

    let hours = 0;
    let minutes = 0;
    const isOver10 = document.getElementById('weeklyIsOver10Hours')?.checked || false;

    // 기존 스크린타임 로직과 동일하게 파싱
    if (codeStr.length === 4) {
      hours = parseInt(codeStr.substring(0, 2));
      minutes = parseInt(codeStr.substring(2, 4));
    } else if (codeStr.length === 3) {
      if (isOver10) {
        hours = parseInt(codeStr.substring(0, 2));
        minutes = parseInt(codeStr.substring(2, 3));
      } else {
        hours = parseInt(codeStr.substring(0, 1));
        minutes = parseInt(codeStr.substring(1, 3));
      }
    } else if (codeStr.length <= 2) {
      // 2자리 이하는 분으로만 간주하거나, 아직 입력 중으로 처리
      // 여기서는 일단 분으로 처리하되, 사용자가 계속 입력할 것임
      hours = 0;
      minutes = parseInt(codeStr);
    }

    let isValid = true;
    let message = `📱 ${hours}시간 ${minutes}분`;
    let color = '#2d3748';

    if (minutes >= 60) {
      message = '⚠️ 분은 59 이하여야 합니다';
      color = '#EF4444';
      isValid = false;
    } else if (hours >= 24) {
      message = '⚠️ 24시간을 넘을 수 없습니다';
      color = '#EF4444';
      isValid = false;
    }

    if (preview) {
      preview.textContent = message;
      preview.style.color = color;
    }

    // 제출 버튼 활성화: 유효한 값이고, 최소 1글자 이상 입력됨
    // (기존 스크린타임은 4자리 입력을 강제하지 않음. 130 -> 1시간 30분 가능)
    toggleSubmitBtn(isValid && codeStr.length > 0);
  }

  function toggleSubmitBtn(enabled) {
    const btn = document.getElementById('weekly-verification-submit-btn');
    if (btn) btn.disabled = !enabled;
  }

  function handleSubmit() {
    const d1 = document.getElementById('weeklyDigit1').value || '';
    const d2 = document.getElementById('weeklyDigit2').value || '';
    const d3 = document.getElementById('weeklyDigit3').value || '';
    const d4 = document.getElementById('weeklyDigit4').value || '';
    const codeStr = d1 + d2 + d3 + d4;

    if (codeStr.length === 0) {
      showToast('평균 스크린타임을 입력해주세요');
      return;
    }

    let hours = 0;
    let minutes = 0;
    const isOver10 = document.getElementById('weeklyIsOver10Hours')?.checked || false;

    if (codeStr.length === 4) {
      hours = parseInt(codeStr.substring(0, 2));
      minutes = parseInt(codeStr.substring(2, 4));
    } else if (codeStr.length === 3) {
      if (isOver10) {
        hours = parseInt(codeStr.substring(0, 2));
        minutes = parseInt(codeStr.substring(2, 3));
      } else {
        hours = parseInt(codeStr.substring(0, 1));
        minutes = parseInt(codeStr.substring(1, 3));
      }
    } else {
      hours = 0;
      minutes = parseInt(codeStr);
    }

    const totalMinutes = hours * 60 + minutes;
    submitWeeklyVerification(totalMinutes);
  }
}

/**
 * 주간 검증 제출
 */
async function submitWeeklyVerification(userInputAverage) {
  try {
    showGlobalLoading('검증 중...');

    const headers = await getAuthHeaders();
    const response = await fetch('/api/screen-time/verify', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInputAverage })
    });

    const result = await response.json();
    hideGlobalLoading();

    if (!response.ok) {
      showToast(result.message || '검증 실패');
      return;
    }

    if (result.success) {
      if (result.data.verified) {
        // ✅ 검증 성공
        showToast('검증 완료! 스크린타임을 입력할 수 있습니다.');
        isWeeklyVerificationRequired = false;
        closeWeeklyVerificationModal();
        // 미션 카드 전환 애니메이션
        if (typeof animateCardTransition === 'function') {
          animateCardTransition();
        } else if (typeof updateHomeMissionCards === 'function') {
          updateHomeMissionCards();
        }
      } else {
        // ⚠️ 검증 실패 - 경고
        handleVerificationFailure(result.data);
      }
    }
  } catch (error) {
    hideGlobalLoading();
    console.error('Weekly verification submit error:', error);
    showToast('검증 중 오류가 발생했습니다');
  }
}

/**
 * 검증 실패 처리
 */
function handleVerificationFailure(data) {
  const warningStatusEl = document.getElementById('warning-status');
  const warningCountEl = document.getElementById('warning-count-display');
  const warningMessageEl = document.getElementById('warning-message');

  if (data.penalty) {
    // 🚨 3회 오입력 - 포켓몬 삭제
    showToast(data.message);

    // 주간 검증 UI 내 경고 표시
    if (warningStatusEl) {
      warningStatusEl.style.display = 'flex';
      warningCountEl.textContent = '3';
      warningMessageEl.innerHTML = `<strong style="color: #e53e3e;">포켓몬 ${data.deletedPokemonCount}마리가 삭제되었습니다.</strong>`;
    }

    // 입력 필드 초기화
    document.getElementById('weeklyDigit1').value = '';
    document.getElementById('weeklyDigit2').value = '';
    document.getElementById('weeklyDigit3').value = '';
    document.getElementById('weeklyDigit4').value = '';
    const preview = document.getElementById('weeklyVerificationPreview');
    if (preview) preview.textContent = '-';
    document.getElementById('weekly-verification-submit-btn').disabled = true;

    // 포켓몬 목록 새로고침
    if (typeof loadUserPokemonIcons === 'function') loadUserPokemonIcons();
    if (typeof loadHomeFavoritePokemon === 'function') loadHomeFavoritePokemon();
    if (typeof loadTodayObtainedPokemon === 'function') loadTodayObtainedPokemon();

  } else {
    // 1~2회 경고
    showToast(data.message);

    if (warningStatusEl) {
      warningStatusEl.style.display = 'flex';
      warningCountEl.textContent = data.warningCount;

      if (data.warningCount === 1) {
        warningMessageEl.textContent = '입력값과 기록값의 차이가 10% 이상입니다.';
      } else if (data.warningCount === 2) {
        warningMessageEl.innerHTML = '<strong style="color: #e53e3e;">한 번 더 오입력 시 포켓몬이 모두 삭제됩니다!</strong>';
      }
    }

    // 입력 필드 초기화
    document.getElementById('weeklyDigit1').value = '';
    document.getElementById('weeklyDigit2').value = '';
    document.getElementById('weeklyDigit3').value = '';
    document.getElementById('weeklyDigit4').value = '';
    const preview = document.getElementById('weeklyVerificationPreview');
    if (preview) preview.textContent = '-';
    document.getElementById('weekly-verification-submit-btn').disabled = true;
  }
}

/**
 * 스크린타임 입력 전 검증 확인
 * @returns {boolean} true면 입력 가능, false면 차단
 */
function checkScreenTimeInputAllowed() {
  if (isWeeklyVerificationRequired) {
    showToast('지난주 평균 검증을 먼저 완료해주세요!');

    // 홈 탭으로 전환
    const homeTabBtn = document.querySelector('[data-tab="home"]');
    if (homeTabBtn) homeTabBtn.click();

    showWeeklyVerificationModal();
    return false;
  }
  return true;
}

// 전역 노출
window.checkScreenTimeInputAllowed = checkScreenTimeInputAllowed;
window.checkMissionStatus = checkMissionStatus;
window.checkWeeklyVerificationStatus = checkWeeklyVerificationStatus;

// ==================== 홈탭 미션 카드 및 주간 달성 바 ==================== //

/**
 * 스크린타임 입력 모달 열기
 */
function openScreenTimeModal() {
  // 앞선 미션(주간 검증)이 필요한 경우 차단
  if (isWeeklyVerificationRequired) {
    showToast('앞선 미션을 먼저 해결해주세요!');
    return;
  }

  const modal = document.getElementById('screen-time-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    onModalOpen();

    // 입력 필드 초기화
    const digit1 = document.getElementById('screenTimeDigit1');
    if (digit1) digit1.focus();
  }
}
window.openScreenTimeModal = openScreenTimeModal;

/**
 * 스크린타임 입력 모달 닫기
 */
function closeScreenTimeModal() {
  const modal = document.getElementById('screen-time-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
  }
}
window.closeScreenTimeModal = closeScreenTimeModal;

/**
 * 주간 검증 모달 열기 (미션 카드에서 호출)
 */
function openWeeklyVerificationFromCard() {
  showWeeklyVerificationModal();
}
window.openWeeklyVerificationFromCard = openWeeklyVerificationFromCard;

/**
 * 홈탭 미션 카드 상태 업데이트 (스택 방식)
 */
function updateHomeMissionCards() {
  const homeMissionsSection = document.getElementById('homeMissionsSection');
  const cardStack = document.getElementById('missionCardStack');
  const verificationCard = document.getElementById('weeklyVerificationCard');
  const screenTimeCard = document.getElementById('screenTimeCard');
  const screenTimeCardSubtitle = document.getElementById('screenTimeCardSubtitle');

  if (!cardStack) return;

  // 기본적으로 섹션 표시
  if (homeMissionsSection) homeMissionsSection.style.display = 'block';

  // 주간 검증 필요 여부에 따라 카드 표시
  if (isWeeklyVerificationRequired && weeklyVerificationData) {
    // 검증 카드 표시 (앞쪽)
    if (verificationCard) {
      verificationCard.style.display = 'flex';
    }
    // 스택에 앞쪽 카드가 있음을 표시
    cardStack.classList.add('has-front');

    // 스크린타임 카드는 뒤에 보이도록 유지하되 메시지 변경
    if (screenTimeCard) {
      screenTimeCard.style.display = 'flex';
    }
    if (screenTimeCardSubtitle) {
      screenTimeCardSubtitle.textContent = '먼저 주간 검증을 완료해주세요';
    }
  } else {
    // 검증 카드 숨기기
    if (verificationCard) {
      verificationCard.style.display = 'none';
    }
    // 스택에서 앞쪽 카드 제거
    cardStack.classList.remove('has-front');

    // 어제 스크린타임 입력 필요 여부 체크
    if (!needsYesterdayScreenTime) {
      // 어제 입력을 완료했다면 스크린타임 카드 숨기기
      if (screenTimeCard) {
        screenTimeCard.style.display = 'none';
      }
      // 검증도 없고 스크린타임도 완료했다면 섹션 전체 숨기기
      if (homeMissionsSection) {
        homeMissionsSection.style.display = 'none';
      }
    } else {
      // 어제 입력이 필요하다면 스크린타임 카드 표시
      if (screenTimeCard) {
        screenTimeCard.style.display = 'flex';
      }
      if (screenTimeCardSubtitle) {
        screenTimeCardSubtitle.textContent = '어제의 스크린타임을 기록해주세요';
      }
    }
  }
}
window.updateHomeMissionCards = updateHomeMissionCards;

/**
 * 검증 완료 후 카드 전환 애니메이션
 */
function animateCardTransition() {
  const cardStack = document.getElementById('missionCardStack');
  const verificationCard = document.getElementById('weeklyVerificationCard');
  const screenTimeCard = document.getElementById('screenTimeCard');
  const screenTimeCardSubtitle = document.getElementById('screenTimeCardSubtitle');

  if (!verificationCard || !screenTimeCard) {
    updateHomeMissionCards();
    return;
  }

  // 1. 검증 카드에 exit 애니메이션 추가
  verificationCard.classList.add('card-exit');

  // 2. 스크린타임 카드에 reveal 애니메이션 추가
  screenTimeCard.classList.add('card-reveal');

  // 3. 스크린타임 카드 메시지 업데이트
  if (screenTimeCardSubtitle) {
    screenTimeCardSubtitle.textContent = '스크린타임을 기록해주세요';
  }

  // 4. 애니메이션 완료 후 정리
  setTimeout(() => {
    verificationCard.classList.remove('card-exit');
    verificationCard.style.display = 'none';
    screenTimeCard.classList.remove('card-reveal');
    if (cardStack) {
      cardStack.classList.remove('has-front');
    }
  }, 800);
}
window.animateCardTransition = animateCardTransition;

/**
 * 주간 달성 바 업데이트 (일요일~토요일)
 */
async function updateWeeklyAchievementBar() {
  // 게스트 모드에서는 더미 데이터 표시 (일~토 순서)
  if (window.isGuest()) {
    updateWeeklyAchievementBarUI([false, true, true, false, false, false, false], 3);
    return;
  }

  if (!window.isAuthenticated()) {
    return;
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/screen-time/weekly-stats', { headers });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        const weeklyData = result.data;
        const completedDays = [false, false, false, false, false, false, false];

        // dailyRecords 배열을 순회하며 완료된 요일 체크
        const dailyRecords = weeklyData.dailyRecords || [];
        const dailyTimes = Array(7).fill(null);

        console.log('Weekly Data:', weeklyData);
        console.log('Daily Records:', dailyRecords);

        dailyRecords.forEach(record => {
          if (record && record.date) {
            // YYYY-MM-DD 형식의 날짜를 파싱하여 요일 인덱스 추출
            const dateObj = new Date(record.date);
            const dayIndex = dateObj.getDay(); // 0(일) ~ 6(토)
            if (dayIndex >= 0 && dayIndex <= 6) {
              completedDays[dayIndex] = true;

              // 시간 포맷팅 (H'MM)
              const hours = record.hours || 0;
              const minutes = record.minutes || 0;
              const timeLabel = `${hours}'${minutes.toString().padStart(2, '0')}`;
              dailyTimes[dayIndex] = timeLabel;
              console.log(`Day ${dayIndex} (${record.date}): hours=${hours}, minutes=${minutes}, label=${timeLabel}`);
            }
          }
        });

        // 오늘 요일 인덱스 (일=0, 월=1, ... 토=6)
        const now = new Date();
        const todayIndex = now.getDay();

        // 오늘의 입력 완료 여부 저장 (서버 데이터 기반)
        isTodayScreenTimeCompleted = completedDays[todayIndex];

        console.log('Completed Days:', completedDays);
        console.log('Daily Times:', dailyTimes);
        console.log('Today Index:', todayIndex);

        updateWeeklyAchievementBarUI(completedDays, dailyTimes, todayIndex);

        // 미션 카드 상태 업데이트 (이미 완료했으면 카드 숨김 등)
        updateHomeMissionCards();
      }
    }
  } catch (error) {
    console.error('Failed to update weekly achievement bar:', error);
  }
}

/**
 * 주간 달성 바 UI 업데이트 (일~토 순서, 통합 라벨)
 */
function updateWeeklyAchievementBarUI(completedDays, dailyTimes, todayIndex) {
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  for (let i = 0; i < 7; i++) {
    const dayCircle = document.getElementById(`weeklyDay${i}`);
    if (!dayCircle) continue;

    const label = dayLabels[i];
    let timeLabel = '';

    // 완료 상태 업데이트
    if (completedDays[i]) {
      dayCircle.classList.add('completed');
      dayCircle.textContent = label;
      timeLabel = dailyTimes[i] || '';
    } else {
      dayCircle.classList.remove('completed');
      dayCircle.textContent = label;
    }

    // 오늘 표시
    if (i === todayIndex) {
      dayCircle.classList.add('today');
      // 오늘인데 완료 안했으면 '오늘', 완료했으면 시간
      if (!timeLabel) timeLabel = '오늘';
    } else {
      dayCircle.classList.remove('today');
    }

    // 데이터 라벨 설정 (CSS content: attr(data-label)에서 사용)
    dayCircle.setAttribute('data-label', timeLabel);
  }
}
window.updateWeeklyAchievementBar = updateWeeklyAchievementBar;

/**
 * 홈탭 초기화 시 호출
 */
function initHomeTab() {
  updateHomeMissionCards();
  updateWeeklyAchievementBar();
}
window.initHomeTab = initHomeTab;
